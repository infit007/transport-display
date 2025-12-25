-- Add manager role to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'manager';

-- Create RLS policies for manager role
-- Managers can view buses but not modify them
CREATE POLICY "Managers can view buses"
  ON public.buses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Managers can view news feeds
CREATE POLICY "Managers can view news feeds"
  ON public.news_feeds FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Managers can create and update news feeds
CREATE POLICY "Managers can manage news feeds"
  ON public.news_feeds FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Managers can view media library (for assignment) but not upload
CREATE POLICY "Managers can view media library"
  ON public.media_library FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Managers can assign media to buses
CREATE POLICY "Managers can assign media to buses"
  ON public.media_library FOR INSERT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Managers can replace media assignments
CREATE POLICY "Managers can replace media assignments"
  ON public.media_library FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Managers cannot upload media content (only admins can)
CREATE POLICY "Only admins can upload media content"
  ON public.media_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
