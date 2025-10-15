-- Run this SQL in your Supabase SQL Editor to set up image storage

-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  folder TEXT NOT NULL DEFAULT 'Unsorted',
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  phash TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations on images" ON images
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for images (this creates the bucket in Supabase Storage)
-- Note: You'll need to create this in the Supabase Dashboard under Storage
-- Bucket name: "patent-images"
-- Public: Yes (so images can be viewed)

-- After creating the bucket in the UI, run this to set the policy:
-- (This will be done in the Supabase Dashboard Storage section)

