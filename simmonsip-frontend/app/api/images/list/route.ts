import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "data", "images.json");
    const arr: any[] = JSON.parse(await fs.readFile(dataPath, "utf8"));
    return NextResponse.json(arr, { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}







