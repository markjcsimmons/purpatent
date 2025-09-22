"use client";
import { useEffect, useState } from "react";

interface Result {
  company: string;
  keyword: string;
  url: string;
  context?: string;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [includeImages, setIncludeImages] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pp_trawl_results");
    if (saved) setResults(JSON.parse(saved) as Result[]);
  }, []);

  const runTrawl = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includeImages) params.set("includeImages", "1");
      // Accuracy-first defaults: include marketplaces, JS-render fallback, generous timeouts
      params.set("maxSites", "20");
      params.set("concurrency", "3");
      params.set("renderDelayMs", "1500");
      params.set("fetchTimeoutMs", "15000");
      // Keep client-side abort slightly above server deadline to avoid premature aborts
      params.set("deadlineMs", "600000");

      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 630000);
      const res = await fetch(`/api/trawl?${params.toString()}`, { signal: controller.signal });
      clearTimeout(to);
      const data = await res.json();
      setResults(data.results || []);
      localStorage.setItem("pp_trawl_results", JSON.stringify(data.results || []));
    } catch {
      // eslint-disable-next-line no-alert
      alert("Failed to trawl");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center pt-8 w-full">
      <div className="flex flex-wrap gap-3 items-end">
        <button
          onClick={runTrawl}
          disabled={loading}
          className="mt-4 px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-800 text-xs font-bold uppercase disabled:opacity-50"
        >
          {loading ? "Trawling..." : "Trawl"}
        </button>
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={includeImages}
            onChange={(e) => setIncludeImages(e.target.checked)}
          />
          Include images
        </label>
      </div>

      {results.length === 0 && !loading && (
        <p className="mt-6 text-sm text-gray-500">NO RESULTS</p>
      )}

      {results.length > 0 && (
        <div className="mt-8 w-full max-w-4xl overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-200 px-2 py-1 text-left">Company</th>
                <th className="border border-gray-200 px-2 py-1 text-left">Keyword</th>
                <th className="border border-gray-200 px-2 py-1 text-left">URL</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border px-1 py-0.5">{r.company}</td>
                  <td className="border px-1 py-0.5">
                    <div className="font-semibold">{r.keyword}</div>
                    {r.context && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{r.context}</div>
                    )}
                  </td>
                  <td className="border px-1 py-0.5">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600 hover:text-blue-800"
                    >
                      Link
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
