import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { url, folder: folderRaw } = await request.json();
    const folder = typeof folderRaw === "string" && folderRaw.trim() ? folderRaw.trim() : "Unsorted";
    
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // For external URLs, we'll just store the reference without downloading
    // Computing a hash of the URL as a fingerprint
    const phash = createHash("sha1").update(url).digest("hex");

    // Store metadata in database (using the URL as-is, no local upload)
    const { error: dbError } = await supabase
      .from('images')
      .insert({
        folder,
        filename: url.split('/').pop() || 'external',
        url: url,
        phash
      });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ url, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

