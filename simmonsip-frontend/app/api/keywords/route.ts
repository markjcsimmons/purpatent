import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
    "Cache-Control": "no-store",
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
      .from('keywords')
      .select('*')
      .order('keyword', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const res = NextResponse.json(data || []);
    const origin = allowOriginFrom(req);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Delete all existing keywords
    const { error: deleteError } = await supabase
      .from('keywords')
      .delete()
      .neq('id', 0); // Delete all rows

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new keywords
    const { error: insertError } = await supabase
      .from('keywords')
      .insert(body);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });
    const origin = allowOriginFrom(req);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}







