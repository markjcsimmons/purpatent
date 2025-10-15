import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No url" }, { status: 400 });
    }

    // Find the image in the database
    const { data: images, error: findError } = await supabase
      .from('images')
      .select('*')
      .eq('url', url)
      .single();

    if (findError || !images) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete from storage
    const storagePath = `${images.folder}/${images.filename}`;
    await supabase.storage
      .from('patent-images')
      .remove([storagePath]);

    // Delete from database
    const { error: deleteError } = await supabase
      .from('images')
      .delete()
      .eq('url', url);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}







