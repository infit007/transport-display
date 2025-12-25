-- Media Library table for storing uploaded files and video links
CREATE TABLE IF NOT EXISTS public.media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('file', 'link')),
  url text NOT NULL,
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  file_size bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "media_library_read" ON public.media_library;
CREATE POLICY "media_library_read" ON public.media_library
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "media_library_write_admin" ON public.media_library;
CREATE POLICY "media_library_write_admin" ON public.media_library
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_media_library_updated_at ON public.media_library;
CREATE TRIGGER update_media_library_updated_at
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
