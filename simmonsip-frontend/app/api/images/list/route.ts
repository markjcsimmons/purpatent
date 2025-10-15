import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type StoredImage = { folder: string; url: string; filename?: string; phash?: string };

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
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  const origin = allowOriginFrom(req);
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return new NextResponse(JSON.stringify([]), { status: 200 });
    }

    const origin = allowOriginFrom(req);
    return new NextResponse(JSON.stringify(data || []), { status: 200, headers: corsHeaders(origin) });
  } catch {
    return new NextResponse(JSON.stringify([]), { status: 200 });
  }
}







