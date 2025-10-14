-- Run this SQL in your Supabase SQL Editor to create the tables
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run

-- Create competitors table
CREATE TABLE IF NOT EXISTS competitors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create keywords table
CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  patent TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - allows public read/write for now
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations on competitors" ON competitors
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on keywords" ON keywords
  FOR ALL
  USING (true)
  WITH CHECK (true);

