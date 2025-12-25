-- Add RLS policies for public access to buses table
-- This allows the TV Display App to read bus data without authentication

-- Allow public read access to buses table
DROP POLICY IF EXISTS "buses_public_read" ON public.buses;
CREATE POLICY "buses_public_read" ON public.buses
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow public read access to news_feeds table
DROP POLICY IF EXISTS "news_feeds_public_read" ON public.news_feeds;
CREATE POLICY "news_feeds_public_read" ON public.news_feeds
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Allow public read access to media_library table
DROP POLICY IF EXISTS "media_library_public_read" ON public.media_library;
CREATE POLICY "media_library_public_read" ON public.media_library
  FOR SELECT TO anon, authenticated
  USING (true);
