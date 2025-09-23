import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { folder } = await req.json();
    if (!folder || typeof folder !== "string") {
      return NextResponse.json({ error: "No folder" }, { status: 400 });
    }

    const dataPath = path.join(process.cwd(), "data", "images.json");
    let arr: { folder: string; url: string; filename?: string; phash?: string }[] = [];
    try {
      arr = JSON.parse(await fs.readFile(dataPath, "utf8"));
    } catch {}

    const toRemove = arr.filter((i) => i.folder === folder);
    if (toRemove.length === 0) {
      // Still attempt to remove the folder on disk for cleanliness
      const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
      await fs.rm(uploadsDir, { recursive: true, force: true }).catch(() => {});
      return NextResponse.json({ success: true, removed: 0 });
    }

    const remaining = arr.filter((i) => i.folder !== folder);
    await fs.writeFile(dataPath, JSON.stringify(remaining, null, 2), "utf8");

    // Remove files and the folder itself
    const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
    await fs.rm(uploadsDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({ success: true, removed: toRemove.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}



