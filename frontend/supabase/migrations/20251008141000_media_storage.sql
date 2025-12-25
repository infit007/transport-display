-- Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media-files', 'media-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for media files
DROP POLICY IF EXISTS "media_files_select" ON storage.objects;
CREATE POLICY "media_files_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'media-files');

DROP POLICY IF EXISTS "media_files_insert" ON storage.objects;
CREATE POLICY "media_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "media_files_update" ON storage.objects;
CREATE POLICY "media_files_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'media-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "media_files_delete" ON storage.objects;
CREATE POLICY "media_files_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'media-files' AND auth.role() = 'authenticated');
