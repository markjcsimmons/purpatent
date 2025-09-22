import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import Papa from "papaparse";

const dataDir = path.join(process.cwd(), "data");
const jsonPath = path.join(dataDir, "keywords.json");
const csvPath = path.join(process.cwd(), "public", "patent_keywords.csv");

async function ensureJson() {
  try {
    await fs.access(jsonPath);
  } catch {
    // json doesn't exist, create from csv
    const csv = await fs.readFile(csvPath, "utf8");
    const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
  }
}

export async function GET() {
  await ensureJson();
  const json = await fs.readFile(jsonPath, "utf8");
  return NextResponse.json(JSON.parse(json));
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}







