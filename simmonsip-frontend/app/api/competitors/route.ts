import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import Papa from "papaparse";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const jsonPath = path.join(dataDir, "competitors.json");
const csvPath = path.join(process.cwd(), "public", "competitors.csv");

function allowOriginFrom(req: NextRequest): string {
  const origin = req.headers.get("origin") || "";
  const allowed = new Set([
    "https://purpatent.com",
    "https://www.purpatent.com",
    "http://localhost:3000",
  ]);
  return allowed.has(origin) ? origin : "";
}

function corsHeaders(origin: string): HeadersInit {
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  const origin = allowOriginFrom(req);
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

async function ensureJson() {
  try {
    await fs.access(jsonPath);
  } catch {
    const csv = await fs.readFile(csvPath, "utf8");
    const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
  }
}

export async function GET(req: NextRequest) {
  await ensureJson();
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const json = await fs.readFile(jsonPath, "utf8");
  const body = debug ? { dataDir, jsonPath, data: JSON.parse(json) } : JSON.parse(json);
  const res = NextResponse.json(body);
  const origin = allowOriginFrom(req);
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(body, null, 2), "utf8");
    const res = NextResponse.json({ ok: true, dataDir, jsonPath });
    const origin = allowOriginFrom(req);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}







