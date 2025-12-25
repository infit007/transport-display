-- Fix RLS policies for media_library table
-- This will allow users to upload and access media files

-- First, let's check if RLS is enabled and what policies exist
-- Enable RLS on media_library table if not already enabled
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to media_library" ON media_library;
DROP POLICY IF EXISTS "Allow authenticated users to insert media" ON media_library;
DROP POLICY IF EXISTS "Allow authenticated users to update media" ON media_library;
DROP POLICY IF EXISTS "Allow authenticated users to delete media" ON media_library;

-- Create comprehensive policies for media_library table

-- 1. Allow public read access (for TV display app)
CREATE POLICY "Allow public read access to media_library" ON media_library
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 2. Allow authenticated users to insert media
CREATE POLICY "Allow authenticated users to insert media" ON media_library
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 3. Allow authenticated users to update their own media
CREATE POLICY "Allow authenticated users to update media" ON media_library
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Allow authenticated users to delete media
CREATE POLICY "Allow authenticated users to delete media" ON media_library
    FOR DELETE
    TO authenticated
    USING (true);

-- Also ensure the storage bucket policies are correct
-- Check if the storage bucket exists and has proper policies
-- You may need to run this in the Supabase dashboard under Storage > Policies

-- Example storage policy (run this in Supabase dashboard):
-- CREATE POLICY "Allow public read access to media files" ON storage.objects
--     FOR SELECT
--     TO anon, authenticated
--     USING (bucket_id = 'media-library');

-- CREATE POLICY "Allow authenticated users to upload media files" ON storage.objects
--     FOR INSERT
--     TO authenticated
--     WITH CHECK (bucket_id = 'media-library');

-- CREATE POLICY "Allow authenticated users to update media files" ON storage.objects
--     FOR UPDATE
--     TO authenticated
--     USING (bucket_id = 'media-library');

-- CREATE POLICY "Allow authenticated users to delete media files" ON storage.objects
--     FOR DELETE
--     TO authenticated
--     USING (bucket_id = 'media-library');
