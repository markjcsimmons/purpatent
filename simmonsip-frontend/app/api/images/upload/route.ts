import { NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const folderRaw = form.get("folder");
    const folder = typeof folderRaw === "string" && folderRaw.trim() ? folderRaw.trim() : "Unsorted";
    
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${randomUUID()}.${ext}`;
    const storagePath = `${folder}/${filename}`;

    // Compute file hash as fingerprint
    const phash = createHash("sha1").update(buffer).digest("hex");

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('patent-images')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/png',
        upsert: false
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('patent-images')
      .getPublicUrl(storagePath);

    // Store metadata in database
    const { error: dbError } = await supabase
      .from('images')
      .insert({
        folder,
        filename,
        url: publicUrl,
        phash
      });

    if (dbError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('patent-images').remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
