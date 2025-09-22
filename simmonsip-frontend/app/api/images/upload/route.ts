import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID, createHash } from "crypto";

const dataDir = path.join(process.cwd(), "data");
const imgJson = path.join(dataDir, "images.json");

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const folderRaw = form.get("folder");
  const folder = typeof folderRaw === "string" && folderRaw.trim() ? folderRaw.trim() : "Unsorted";
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(file.name) || ".png";
  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);

  // compute file hash (sha1) as a stable fingerprint
  const phash = createHash("sha1").update(buffer).digest("hex");

  // persist record
  await fs.mkdir(dataDir, { recursive: true });
  let arr: any[] = [];
  try {
    arr = JSON.parse(await fs.readFile(imgJson, "utf8"));
  } catch {}
  arr.push({ folder, url: `/uploads/${encodeURIComponent(folder)}/${filename}`, filename, phash });
  await fs.writeFile(imgJson, JSON.stringify(arr, null, 2), "utf8");

  return NextResponse.json({ url: `/uploads/${encodeURIComponent(folder)}/${filename}` });
}
