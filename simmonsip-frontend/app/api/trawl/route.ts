import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { createHash } from "crypto";

interface Competitor {
  name: string;
  URL: string;
}

interface KeywordRow {
  keyword: string;
  patent: string;
}

function normalizeForMatch(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildFlexibleRegex(keyword: string, maxGapWords = 30): RegExp {
  const SYNONYMS: Record<string, string[]> = {
    spoon: ["scoop", "scooper"],
    scooper: ["scoop", "spoon"],
    gummies: ["gummy"],
    gummy: ["gummies"],
    capsule: ["capsules", "caps"],
    capsules: ["capsule", "caps"],
    resin: ["paste", "tar", "pitch"],
    violet: ["miron"],
    miron: ["violet"],
  };

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const words = keyword
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => {
      const variants = [w, ...(SYNONYMS[w] || [])].map(escape);
      return `(?:${variants.join("|")})`;
    });
  if (words.length === 0) return /$a/; // never matches
  if (words.length === 1) return new RegExp(`\\b${words[0]}\\b`, "i");

  const between = `(?:[\\W_]+\\w+){0,${Math.max(0, maxGapWords - 1)}}[\\W_]+`;
  const seq = (arr: string[]) => `\\b${arr.join(`\\b${between}`)}\\b`;
  const forward = new RegExp(seq(words), "i");
  const reverse = new RegExp(seq([...words].reverse()), "i");
  return new RegExp(`${forward.source}|${reverse.source}`, "i");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dry = url.searchParams.get("dry") === "1";
    const selftest = url.searchParams.get("selftest") === "1";
    const info = url.searchParams.get("info") === "1";
    const includeImages = url.searchParams.get("includeImages") === "1";
    const skipRender = url.searchParams.get("skipRender") === "1";
    const maxSites = Number(url.searchParams.get("maxSites") || 0) || Infinity;
    const maxImagesPerSite = Number(url.searchParams.get("maxImages") || 0) || 20;
    const concurrency = Math.max(1, Number(url.searchParams.get("concurrency") || 4));
    const renderDelayMs = Math.max(0, Number(url.searchParams.get("renderDelayMs") || 1000));
    const fetchTimeoutMs = Math.max(1000, Number(url.searchParams.get("fetchTimeoutMs") || 10000));
    const deadlineMs = Math.max(3000, Number(url.searchParams.get("deadlineMs") || (skipRender ? 90000 : 180000)));
    const idxParam = url.searchParams.get("idx");
    const idx = idxParam !== null ? Number(idxParam) : NaN;
    const limitKeywords = Number(url.searchParams.get("limitKeywords") || 0);

    if (dry) {
      return NextResponse.json({ results: [] });
    }

    if (selftest) {
      const sentence = "our shilajit resin is very pure and includes pure gold";
      const sentenceNorm = normalizeForMatch(sentence);
      const tests = ["gold shilajit", "shilajit gold", "pure gold", "gold resin shilajit"];
      const out = tests.map((kw) => {
        const re = buildFlexibleRegex(normalizeForMatch(kw), 30);
        const m = re.exec(sentenceNorm);
        return { kw, match: !!m };
      });
      return NextResponse.json({ results: out });
    }

    const base = process.cwd();
    const compPath = path.join(base, "data", "competitors.json");
    const keyPath = path.join(base, "data", "keywords.json");

    let competitors: Competitor[] = [];
    try {
      competitors = JSON.parse(await fs.readFile(compPath, "utf8"));
    } catch {}

    let rawKeywords: string[] = [];
    try {
      rawKeywords = (JSON.parse(await fs.readFile(keyPath, "utf8")) as KeywordRow[])
        .map((k) => k.keyword.trim())
        .filter((k) => k.length >= 1);
    } catch {}

    if (limitKeywords > 0 && Number.isFinite(limitKeywords)) {
      rawKeywords = rawKeywords.slice(0, limitKeywords);
    }

    if (info) {
      return NextResponse.json({
        competitorsCount: competitors.length,
        keywordsCount: rawKeywords.length,
        firstCompetitors: competitors.slice(0, 3),
        sampleKeywords: rawKeywords.slice(0, 5),
      });
    }

    const keywordRegexes = rawKeywords.map((kw) => ({ kw, re: buildFlexibleRegex(normalizeForMatch(kw), 30) }));

    let stored: { url: string; filename: string; phash: string }[] = [];
    try {
      stored = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "images.json"), "utf8"));
    } catch {}

    const results: { company: string; keyword: string; url: string; context?: string }[] = [];
    const startedAt = Date.now();
    let sitesProcessed = 0;
    let pagesRendered = 0;

    let toProcess = competitors.slice(0, Number.isFinite(maxSites) ? maxSites : competitors.length);
    if (!Number.isNaN(idx) && idx >= 0 && idx < competitors.length) {
      toProcess = [competitors[idx]];
    }

    let sharedBrowser: any | null = null;

    const withTimeout = async (input: RequestInfo | URL, opts: RequestInit & { timeoutMs?: number } = {}) => {
      const { timeoutMs = fetchTimeoutMs, ...rest } = opts;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(input, { ...rest, signal: controller.signal });
      } finally {
        clearTimeout(id);
      }
    };

    const fetchWithRetry = async (
      input: RequestInfo | URL,
      opts: RequestInit & { timeoutMs?: number } = {},
      retries = 1,
      backoffMs = 400
    ): Promise<Response> => {
      try {
        const res = await withTimeout(input, opts);
        if (!res.ok && retries > 0) {
          await new Promise((r) => setTimeout(r, backoffMs));
          return fetchWithRetry(input, opts, retries - 1, backoffMs * 2);
        }
        return res;
      } catch (err) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, backoffMs));
          return fetchWithRetry(input, opts, retries - 1, backoffMs * 2);
        }
        throw err;
      }
    };

    const defaultHeaders: HeadersInit = {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      connection: "keep-alive",
    };

    const processOne = async (comp: Competitor) => {
      try {
        const compUrlTop = new URL(comp.URL);
        const isWalmartSearchTop = /(^|\.)walmart\.com$/i.test(compUrlTop.hostname) && /\/?search/i.test(compUrlTop.pathname);
        const isWalgreensTop = /(^|\.)walgreens\.com$/i.test(compUrlTop.hostname) && /search\//i.test(compUrlTop.pathname);
        const isCVSTop = /(^|\.)cvs\.com$/i.test(compUrlTop.hostname) && /\/search/i.test(compUrlTop.pathname);
        const isTargetTop = /(^|\.)target\.com$/i.test(compUrlTop.hostname) && (/(\/?s)$/i.test(compUrlTop.pathname) || /searchTerm=/.test(compUrlTop.search));
        const isBestBuyTop = /(^|\.)bestbuy\.com$/i.test(compUrlTop.hostname) && /searchpage\.jsp/i.test(compUrlTop.pathname);
        const isGShopTop = /(^|\.)google\.[a-z.]+$/i.test(compUrlTop.hostname) && /\/search/i.test(compUrlTop.pathname) && /tbm=shop/.test(compUrlTop.search);
        const res = await fetchWithRetry(comp.URL, {
          cache: "no-store",
          redirect: "follow",
          timeoutMs: fetchTimeoutMs,
          headers: defaultHeaders,
        });
        const html = await res.text();
        const pageText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        const normText = normalizeForMatch(pageText);

        // eBay listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isEbay = /(^|\.)ebay\.com$/i.test(compUrl.hostname) && /\/sch\//i.test(compUrl.pathname + compUrl.search);
          if (isEbay) {
            type EbayItem = { href: string; title: string; cardText: string };
            const items: EbayItem[] = [];
            const liRe = /<li[^>]*class=\"[^\"]*s-item[^\"]*\"[^>]*>([\s\S]*?)<\/li>/gi;
            let mLi: RegExpExecArray | null;
            while ((mLi = liRe.exec(html))) {
              const block = mLi[1];
              let rawHref = "";
              const linkMatch = /<a[^>]*class=\"[^\"]*s-item__link[^\"]*\"[^>]*href=\"([^\"]+)\"/i.exec(block);
              if (linkMatch) {
                rawHref = linkMatch[1];
              } else {
                const anchorRe = /<a[^>]*href=\"([^\"]+)\"[^>]*>/gi;
                let mA: RegExpExecArray | null;
                while ((mA = anchorRe.exec(block))) {
                  const candidate = mA[1];
                  try {
                    const abs = new URL(candidate, comp.URL).href;
                    if (/\/itm\//i.test(abs)) { rawHref = candidate; break; }
                  } catch {}
                }
                if (!rawHref) continue;
              }
              const titleMatch =
                /<h3[^>]*class=\"[^\"]*s-item__title[^\"]*\"[^>]*>([\s\S]*?)<\/h3>/i.exec(block) ||
                /<span[^>]*role=\"heading\"[^>]*>([\s\S]*?)<\/span>/i.exec(block) ||
                /<div[^>]*class=\"[^\"]*s-item__title[^\"]*\"[^>]*>([\s\S]*?)<\/div>/i.exec(block);
              const titleRaw = titleMatch ? titleMatch[1] : "";
              const title = titleRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              const cardText = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref;
              try { href = new URL(rawHref, comp.URL).href; } catch {}
              if (title || cardText) items.push({ href, title, cardText });
            }

            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const target = it.title || it.cardText;
                  const targetNorm = normalizeForMatch(target);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // Amazon listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isAmazonSearch = /(^|\.)amazon\./i.test(compUrl.hostname) && /[?&]k=/.test(compUrl.search);
          if (isAmazonSearch) {
            type AmazonItem = { href: string; title: string; cardText: string };
            const items: AmazonItem[] = [];
            const cardRe = /<div[^>]*class=\"[^\"]*s-result-item[^\"]*\"[^>]*>([\s\S]*?)<\/div>/gi;
            let mCard: RegExpExecArray | null;
            while ((mCard = cardRe.exec(html))) {
              const block = mCard[1];
              let rawHref = "";
              const linkDp = /<a[^>]*href=\"([^\"]*\/dp\/[^\"]+)\"[^>]*>/i.exec(block);
              const linkProd = /<a[^>]*href=\"([^\"]*\/gp\/[^\"]+)\"[^>]*>/i.exec(block);
              if (linkDp) rawHref = linkDp[1];
              else if (linkProd) rawHref = linkProd[1];
              if (!rawHref) continue;

              const titleMatch =
                /<h2[^>]*>\s*<a[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/a>\s*<\/h2>/i.exec(block) ||
                /<span[^>]*class=\"[^\"]*a-size-medium[^\"]*\"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
              const titleRaw = titleMatch ? titleMatch[1] : "";
              const title = titleRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              const cardText = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref;
              try { href = new URL(rawHref, comp.URL).href; } catch {}
              if (title || cardText) items.push({ href, title, cardText });
            }

            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const target = it.title || it.cardText;
                  const targetNorm = normalizeForMatch(target);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // Etsy listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isEtsySearch = /(^|\.)etsy\.com$/i.test(compUrl.hostname) && /\/?search/i.test(compUrl.pathname);
          if (isEtsySearch) {
            type EtsyItem = { href: string; title: string; cardText: string };
            const items: EtsyItem[] = [];
            const cardRe = /<a[^>]*href=\"([^\"]*\/listing\/[^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
            let mCard: RegExpExecArray | null;
            while ((mCard = cardRe.exec(html))) {
              const rawHref = mCard[1];
              const block = mCard[2];
              const titleMatch =
                /<h3[^>]*class=\"[^\"]*v2-listing-card__title[^\"]*\"[^>]*>([\s\S]*?)<\/h3>/i.exec(block) ||
                /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block) ||
                /<span[^>]*class=\"[^\"]*text-body[^\"]*\"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
              const titleRaw = titleMatch ? titleMatch[1] : "";
              const title = titleRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              const cardText = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref;
              try { href = new URL(rawHref, comp.URL).href; } catch {}
              if (title || cardText) items.push({ href, title, cardText });
            }

            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const target = it.title || it.cardText;
                  const targetNorm = normalizeForMatch(target);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // Walmart listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isWalmartSearch = /(^|\.)walmart\.com$/i.test(compUrl.hostname) && /\/?search/i.test(compUrl.pathname);
          if (isWalmartSearch) {
            type WalmartItem = { href: string; title: string; cardText: string };
            const items: WalmartItem[] = [];
            // Walmart product links usually use /ip/<slug>/<id>
            const aRe = /<a[^>]*href=\"([^\"]*\/ip\/[^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
            let mA: RegExpExecArray | null;
            while ((mA = aRe.exec(html))) {
              const rawHref = mA[1];
              const block = mA[2];
              // Prefer aria-label or title attributes inside anchor
              const attrLabel = /aria-label=\"([^\"]+)\"/i.exec(mA[0]) || /title=\"([^\"]+)\"/i.exec(mA[0]);
              const titleFromAttr = attrLabel ? attrLabel[1] : "";
              const titleText = titleFromAttr || block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref;
              try { href = new URL(rawHref, comp.URL).href; } catch {}
              const cardText = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              if (titleText || cardText) items.push({ href, title: titleText, cardText });
            }

            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const target = it.title || it.cardText;
                  const targetNorm = normalizeForMatch(target);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // Walgreens listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isWalgreens = /(^|\.)walgreens\.com$/i.test(compUrl.hostname) && /search\//i.test(compUrl.pathname);
          if (isWalgreens) {
            type WGItem = { href: string; title: string; cardText: string };
            const items: WGItem[] = [];
            // Product tiles: anchors to /store/c/ or product pages
            const aRe = /<a[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
            let mA: RegExpExecArray | null;
            while ((mA = aRe.exec(html))) {
              const rawHref = mA[1];
              if (!/\/product\//i.test(rawHref) && !/\/(store\/)?c\//i.test(rawHref)) continue;
              const block = mA[2];
              const tRaw = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref; try { href = new URL(rawHref, comp.URL).href; } catch {}
              items.push({ href, title: tRaw, cardText: tRaw });
            }
            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const targetNorm = normalizeForMatch(it.title || it.cardText);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // CVS listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isCVS = /(^|\.)cvs\.com$/i.test(compUrl.hostname) && /\/search/i.test(compUrl.pathname);
          if (isCVS) {
            type CVSItem = { href: string; title: string; cardText: string };
            const items: CVSItem[] = [];
            const aRe = /<a[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
            let mA: RegExpExecArray | null;
            while ((mA = aRe.exec(html))) {
              const rawHref = mA[1];
              if (!/\/shop\//i.test(rawHref) && !/\/p\//i.test(rawHref)) continue;
              const block = mA[2];
              const tRaw = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref; try { href = new URL(rawHref, comp.URL).href; } catch {}
              items.push({ href, title: tRaw, cardText: tRaw });
            }
            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const targetNorm = normalizeForMatch(it.title || it.cardText);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // Target listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isTarget = /(^|\.)target\.com$/i.test(compUrl.hostname) && /\/?s$/i.test(compUrl.pathname) || /searchTerm=/.test(compUrl.search);
          if (isTarget) {
            type TgtItem = { href: string; title: string; cardText: string };
            const items: TgtItem[] = [];
            const aRe = /<a[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
            let mA: RegExpExecArray | null;
            while ((mA = aRe.exec(html))) {
              const rawHref = mA[1];
              if (!/\/p\//i.test(rawHref) && !/\/A\-/i.test(rawHref)) continue;
              const block = mA[2];
              const tRaw = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref; try { href = new URL(rawHref, comp.URL).href; } catch {}
              items.push({ href, title: tRaw, cardText: tRaw });
            }
            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const targetNorm = normalizeForMatch(it.title || it.cardText);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // Best Buy listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isBestBuy = /(^|\.)bestbuy\.com$/i.test(compUrl.hostname) && /searchpage\.jsp/i.test(compUrl.pathname);
          if (isBestBuy) {
            type BBItem = { href: string; title: string; cardText: string };
            const items: BBItem[] = [];
            const aRe = /<a[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
            let mA: RegExpExecArray | null;
            while ((mA = aRe.exec(html))) {
              const rawHref = mA[1];
              if (!/\/site\//i.test(rawHref)) continue;
              const block = mA[2];
              const tRaw = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref; try { href = new URL(rawHref, comp.URL).href; } catch {}
              items.push({ href, title: tRaw, cardText: tRaw });
            }
            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const targetNorm = normalizeForMatch(it.title || it.cardText);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        // Google Shopping listing-level extraction (search results pages)
        try {
          const compUrl = new URL(comp.URL);
          const isGShop = /(^|\.)google\.[a-z.]+$/i.test(compUrl.hostname) && /\/search/i.test(compUrl.pathname) && /tbm=shop/.test(compUrl.search);
          if (isGShop) {
            type GSItem = { href: string; title: string; cardText: string };
            const items: GSItem[] = [];
            const aRe = /<a[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
            let mA: RegExpExecArray | null;
            while ((mA = aRe.exec(html))) {
              const rawHref = mA[1];
              if (!/\/shopping\//i.test(rawHref) && !/\/aclk/i.test(rawHref)) continue;
              const block = mA[2];
              const tRaw = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              let href = rawHref; try { href = new URL(rawHref, comp.URL).href; } catch {}
              items.push({ href, title: tRaw, cardText: tRaw });
            }
            if (items.length > 0) {
              for (const { kw, re } of keywordRegexes) {
                for (const it of items) {
                  const targetNorm = normalizeForMatch(it.title || it.cardText);
                  const m = re.exec(targetNorm);
                  if (m) {
                    const at = m.index;
                    const snippet = targetNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                    results.push({ company: comp.name, keyword: kw, url: it.href, context: it.title || snippet });
                  }
                }
              }
            }
          }
        } catch {}

        let matched = false;
        for (const { kw, re } of keywordRegexes) {
          const m = re.exec(normText);
          if (m) {
            matched = true;
            const at = m.index;
            const snippet = normText.slice(Math.max(0, at - 60), at + m[0].length + 60).trim();
            results.push({ company: comp.name, keyword: kw, url: comp.URL, context: snippet });
          }
        }

        const allowRenderForThisSite = !skipRender || isWalmartSearchTop || isWalgreensTop || isCVSTop || isTargetTop || isBestBuyTop || isGShopTop;
        if (!matched && allowRenderForThisSite) {
          if (Date.now() - startedAt > deadlineMs) {
            return;
          }
          try {
            const { launch } = await import("puppeteer");
            if (!sharedBrowser) {
              sharedBrowser = await launch({
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
                protocolTimeout: Math.min(120000, Math.max(30000, fetchTimeoutMs + 30000)),
              });
            }
            const page = await sharedBrowser.newPage();
            const navTimeout = Math.min(20000, Math.max(5000, fetchTimeoutMs));
            page.setDefaultNavigationTimeout(navTimeout);
            page.setDefaultTimeout(navTimeout);
            await page.goto(comp.URL, { waitUntil: "domcontentloaded", timeout: navTimeout });
            if (renderDelayMs > 0) await new Promise((r) => setTimeout(r, renderDelayMs));
            const textContent = await page.evaluate(() => document.body.innerText);
            pagesRendered += 1;

            const normRenderText = normalizeForMatch(textContent);
            for (const { kw, re } of keywordRegexes) {
              const m = re.exec(normRenderText);
              if (m) {
                const at = m.index;
                const snippet = normRenderText.slice(Math.max(0, at - 60), at + m[0].length + 60).trim();
                results.push({ company: comp.name, keyword: kw, url: comp.URL, context: snippet });
              }
            }
            // Walmart rendered listing extraction: collect anchors to /ip/
            try {
              const compUrl2 = new URL(comp.URL);
              const isWalmartRendered = /(^|\.)walmart\.com$/i.test(compUrl2.hostname) && /\/?search/i.test(compUrl2.pathname);
              if (isWalmartRendered) {
                const anchors = await page.evaluate(() => {
                  const links = Array.from(document.querySelectorAll('a[href*="/ip/"]')) as HTMLAnchorElement[];
                  const tiles = Array.from(document.querySelectorAll('[data-automation-id="productTile"], [data-item-id], [data-tl-id] a')) as HTMLAnchorElement[];
                  const all = Array.from(new Set([...links, ...tiles]));
                  return all.map((a) => ({ href: a.href, title: a.getAttribute('aria-label') || a.title || (a.textContent || '').trim() }));
                });
                for (const { kw, re } of keywordRegexes) {
                  for (const a of anchors) {
                    const t = a.title || '';
                    const tNorm = normalizeForMatch(t);
                    const m = re.exec(tNorm);
                    if (m) {
                      const at = m.index;
                      const snippet = tNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                      results.push({ company: comp.name, keyword: kw, url: a.href, context: t || snippet });
                    }
                  }
                }
              }
            } catch {}

            // Walgreens rendered extraction
            try {
              const compUrl2 = new URL(comp.URL);
              const isWalgreensRendered = /(^|\.)walgreens\.com$/i.test(compUrl2.hostname) && /search\//i.test(compUrl2.pathname);
              if (isWalgreensRendered) {
                const anchors = await page.evaluate(() => {
                  const anchors: HTMLAnchorElement[] = [];
                  const directLinks = Array.from(document.querySelectorAll('a[href*="/product/"], a[href*="/store/c/"], a[href*="/p/"]')) as HTMLAnchorElement[];
                  anchors.push(...directLinks);
                  const titleEls = Array.from(document.querySelectorAll('[data-test="product-card-name"], [data-testid="product-title"], h1, h2, h3')) as HTMLElement[];
                  for (const el of titleEls) {
                    const a = el.closest('a') as HTMLAnchorElement | null;
                    if (a && (a.href.includes('/product/') || a.href.includes('/store/c/') || a.href.includes('/p/'))) anchors.push(a);
                  }
                  const uniq = Array.from(new Set(anchors));
                  return uniq.map((a) => ({ href: a.href, title: a.getAttribute('aria-label') || a.title || (a.textContent || '').trim() }));
                });
                for (const { kw, re } of keywordRegexes) {
                  for (const a of anchors) {
                    const t = a.title || '';
                    const tNorm = normalizeForMatch(t);
                    const m = re.exec(tNorm);
                    if (m) {
                      const at = m.index;
                      const snippet = tNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                      results.push({ company: comp.name, keyword: kw, url: a.href, context: t || snippet });
                    }
                  }
                }
              }
            } catch {}

            // CVS rendered extraction
            try {
              const compUrl2 = new URL(comp.URL);
              const isCVSRendered = /(^|\.)cvs\.com$/i.test(compUrl2.hostname) && /\/search/i.test(compUrl2.pathname);
              if (isCVSRendered) {
                const anchors = await page.evaluate(() => {
                  const anchors: HTMLAnchorElement[] = [];
                  const links = Array.from(document.querySelectorAll('a[href*="/shop/"], a[href*="/p/"]')) as HTMLAnchorElement[];
                  anchors.push(...links);
                  const titleEls = Array.from(document.querySelectorAll('[data-test="productCard-title"], [data-testid="productCard-title"], .product__name a, h2 a')) as HTMLAnchorElement[];
                  anchors.push(...titleEls);
                  const uniq = Array.from(new Set(anchors));
                  return uniq.map((a) => ({ href: a.href, title: a.getAttribute('aria-label') || a.title || (a.textContent || '').trim() }));
                });
                for (const { kw, re } of keywordRegexes) {
                  for (const a of anchors) {
                    const t = a.title || '';
                    const tNorm = normalizeForMatch(t);
                    const m = re.exec(tNorm);
                    if (m) {
                      const at = m.index;
                      const snippet = tNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                      results.push({ company: comp.name, keyword: kw, url: a.href, context: t || snippet });
                    }
                  }
                }
              }
            } catch {}

            // Target rendered extraction
            try {
              const compUrl2 = new URL(comp.URL);
              const isTargetRendered = /(^|\.)target\.com$/i.test(compUrl2.hostname) && ((/\/?s$/i.test(compUrl2.pathname)) || /searchTerm=/.test(compUrl2.search));
              if (isTargetRendered) {
                const anchors = await page.evaluate(() => {
                  const anchors: HTMLAnchorElement[] = [];
                  const titleLinks = Array.from(document.querySelectorAll('a[data-test="product-card-title"], a[data-test="product-card-link"], a[href*="/p/"], a[href*="/A-"]')) as HTMLAnchorElement[];
                  anchors.push(...titleLinks);
                  const withinCards = Array.from(document.querySelectorAll('[data-test="product-grid"] [data-test="product-card"] h3 a')) as HTMLAnchorElement[];
                  anchors.push(...withinCards);
                  const uniq = Array.from(new Set(anchors));
                  return uniq.map((a) => ({ href: a.href, title: a.getAttribute('aria-label') || a.title || (a.textContent || '').trim() }));
                });
                for (const { kw, re } of keywordRegexes) {
                  for (const a of anchors) {
                    const t = a.title || '';
                    const tNorm = normalizeForMatch(t);
                    const m = re.exec(tNorm);
                    if (m) {
                      const at = m.index;
                      const snippet = tNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                      results.push({ company: comp.name, keyword: kw, url: a.href, context: t || snippet });
                    }
                  }
                }
              }
            } catch {}

            // Best Buy rendered extraction
            try {
              const compUrl2 = new URL(comp.URL);
              const isBestBuyRendered = /(^|\.)bestbuy\.com$/i.test(compUrl2.hostname) && /searchpage\.jsp/i.test(compUrl2.pathname);
              if (isBestBuyRendered) {
                const anchors = await page.evaluate(() => {
                  const anchors: HTMLAnchorElement[] = [];
                  const skuTitleLinks = Array.from(document.querySelectorAll('.sku-title a, .sku-header a, a[href*="/site/"]')) as HTMLAnchorElement[];
                  anchors.push(...skuTitleLinks);
                  const uniq = Array.from(new Set(anchors));
                  return uniq.map((a) => ({ href: a.href, title: a.getAttribute('aria-label') || a.title || (a.textContent || '').trim() }));
                });
                for (const { kw, re } of keywordRegexes) {
                  for (const a of anchors) {
                    const t = a.title || '';
                    const tNorm = normalizeForMatch(t);
                    const m = re.exec(tNorm);
                    if (m) {
                      const at = m.index;
                      const snippet = tNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                      results.push({ company: comp.name, keyword: kw, url: a.href, context: t || snippet });
                    }
                  }
                }
              }
            } catch {}

            // Google Shopping rendered extraction
            try {
              const compUrl2 = new URL(comp.URL);
              const isGShopRendered = /(^|\.)google\.[a-z.]+$/i.test(compUrl2.hostname) && /\/search/i.test(compUrl2.pathname) && /tbm=shop/.test(compUrl2.search);
              if (isGShopRendered) {
                const anchors = await page.evaluate(() => {
                  const anchors: HTMLAnchorElement[] = [];
                  const shopLinks = Array.from(document.querySelectorAll('a[href*="/shopping/product"], a[href*="/aclk"], a[class*="sh-np__click-target"], a[class*="shntl"]')) as HTMLAnchorElement[];
                  anchors.push(...shopLinks);
                  const titleEls = Array.from(document.querySelectorAll('a:has(h3), a[role="link"] h3')) as any[];
                  for (const el of titleEls) {
                    const a = (el instanceof HTMLAnchorElement ? el : (el.closest && el.closest('a'))) as HTMLAnchorElement | null;
                    if (a) anchors.push(a);
                  }
                  const uniq = Array.from(new Set(anchors));
                  return uniq.map((a) => ({ href: a.href, title: a.getAttribute('aria-label') || a.title || (a.textContent || '').trim() }));
                });
                for (const { kw, re } of keywordRegexes) {
                  for (const a of anchors) {
                    const t = a.title || '';
                    const tNorm = normalizeForMatch(t);
                    const m = re.exec(tNorm);
                    if (m) {
                      const at = m.index;
                      const snippet = tNorm.slice(Math.max(0, at - 40), at + m[0].length + 40).trim();
                      results.push({ company: comp.name, keyword: kw, url: a.href, context: t || snippet });
                    }
                  }
                }
              }
            } catch {}
            await page.close();
          } catch {}
        }

        if (includeImages) {
          const imgTagRe = /<img[^>]*>/gi;
          const imgUrls: string[] = [];
          let tagMatch: RegExpExecArray | null;
          while ((tagMatch = imgTagRe.exec(html))) {
            const tag = tagMatch[0];
            const srcAttr = /(?:src|data-src)=\"([^\"]+)\"/i.exec(tag);
            if (!srcAttr) continue;
            const rawSrc = srcAttr[1];
            if (rawSrc.includes("${")) continue;
            if (!/^https?:\/\//.test(rawSrc) && !/^\/?\//.test(rawSrc)) continue;
            try {
              const absoluteUrl = new URL(rawSrc, comp.URL).href;
              imgUrls.push(absoluteUrl);
            } catch {}
          }

          for (const imgUrl of imgUrls.slice(0, maxImagesPerSite)) {
            try {
              const resp = await fetchWithRetry(imgUrl, { cache: "no-store", timeoutMs: Math.min(8000, fetchTimeoutMs) }, 1);
              if (!resp.ok) continue;
              const arrayBuf = await resp.arrayBuffer();
              const fingerprint = createHash("sha1").update(Buffer.from(arrayBuf)).digest("hex");
              for (const s of stored) {
                if (fingerprint === s.phash) {
                  results.push({ company: comp.name, keyword: "IMAGE", url: imgUrl });
                }
              }
            } catch {}
          }
        }
      } catch {}
      finally {
        sitesProcessed += 1;
      }
    };

    const start = Date.now();
    for (let i = 0; i < toProcess.length; i += concurrency) {
      if (Date.now() - start > deadlineMs) {
        break;
      }
      const batch = toProcess.slice(i, i + concurrency);
      await Promise.all(batch.map((c) => processOne(c)));
    }

    if (sharedBrowser) {
      try { await sharedBrowser.close(); } catch {}
    }

    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json({ results, meta: { elapsedMs, sitesProcessed, pagesRendered, deadlineMs, fetchTimeoutMs, concurrency } });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to trawl", details: (e as Error).message },
      { status: 500 }
    );
  }
}


