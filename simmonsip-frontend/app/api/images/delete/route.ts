import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No url" }, { status: 400 });
    }
    const dataPath = path.join(process.cwd(), "data", "images.json");
    let arr: { folder: string; url: string; filename?: string; phash?: string }[] = [];
    try {
      arr = JSON.parse(await fs.readFile(dataPath, "utf8"));
    } catch {}

    const idx = arr.findIndex((i) => i.url === url);
    if (idx === -1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const [removed] = arr.splice(idx, 1);
    await fs.writeFile(dataPath, JSON.stringify(arr, null, 2), "utf8");

    // delete actual file if local uploads path
    if (removed.filename) {
      const filePath = path.join(process.cwd(), "public", "uploads", removed.folder || "Unsorted", removed.filename);
      await fs.unlink(filePath).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}







