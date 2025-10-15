import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { folder } = await req.json();
    if (!folder || typeof folder !== "string") {
      return NextResponse.json({ error: "No folder" }, { status: 400 });
    }

    // Find all images in this folder
    const { data: images, error: findError } = await supabase
      .from('images')
      .select('*')
      .eq('folder', folder);

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json({ success: true, removed: 0 });
    }

    // Delete all files from storage
    const storagePaths = images.map(img => `${img.folder}/${img.filename}`);
    await supabase.storage
      .from('patent-images')
      .remove(storagePaths);

    // Delete all records from database
    const { error: deleteError } = await supabase
      .from('images')
      .delete()
      .eq('folder', folder);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, removed: images.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}



