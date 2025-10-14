import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import Papa from "papaparse";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    // Create competitors table
    const { error: competitorsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS competitors (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    // If exec_sql doesn't exist, we'll need to use the SQL editor in Supabase
    // For now, let's try to insert data and see if tables exist
    
    // Check if competitors table has data
    const { data: existingCompetitors, error: checkError } = await supabase
      .from('competitors')
      .select('*')
      .limit(1);

    if (checkError) {
      return NextResponse.json({
        error: "Tables need to be created first. Please run the SQL commands in Supabase SQL Editor.",
        sql: `
-- Run these commands in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS competitors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  patent TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
        `
      }, { status: 500 });
    }

    // Load competitors from CSV if table is empty
    const { count: competitorCount } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true });

    if (competitorCount === 0) {
      const csvPath = path.join(process.cwd(), "public", "competitors.csv");
      const csv = await fs.readFile(csvPath, "utf8");
      const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
      
      const competitors = (data as any[]).map(row => ({
        name: row.name || row.Name,
        url: row.URL || row.url
      }));

      const { error: insertError } = await supabase
        .from('competitors')
        .insert(competitors);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Load keywords from CSV if table is empty
    const { count: keywordCount } = await supabase
      .from('keywords')
      .select('*', { count: 'exact', head: true });

    if (keywordCount === 0) {
      const csvPath = path.join(process.cwd(), "public", "patent_keywords.csv");
      const csv = await fs.readFile(csvPath, "utf8");
      const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
      
      const keywords = (data as any[]).map(row => ({
        keyword: row.keyword || row.Keyword,
        patent: row.patent || row.Patent
      }));

      const { error: insertError } = await supabase
        .from('keywords')
        .insert(keywords);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Migration completed successfully"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

