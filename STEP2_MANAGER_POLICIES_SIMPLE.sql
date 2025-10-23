-- FleetSignage Manager Role Setup - Step 2 (SIMPLIFIED)
-- Run this SECOND in Supabase SQL Editor (after Step 1)

-- Step 2: Create RLS policies for manager role
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Managers can view buses" ON public.buses;
DROP POLICY IF EXISTS "Managers can view news feeds" ON public.news_feeds;
DROP POLICY IF EXISTS "Managers can manage news feeds" ON public.news_feeds;
DROP POLICY IF EXISTS "Managers can view media library" ON public.media_library;
DROP POLICY IF EXISTS "Managers can assign media to buses" ON public.media_library;
DROP POLICY IF EXISTS "Managers can replace media assignments" ON public.media_library;
DROP POLICY IF EXISTS "Only admins can upload media content" ON public.media_content;

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

-- Managers can create and update news feeds (separate policies for different operations)
CREATE POLICY "Managers can select news feeds"
  ON public.news_feeds FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can insert news feeds"
  ON public.news_feeds FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can update news feeds"
  ON public.news_feeds FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can delete news feeds"
  ON public.news_feeds FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Managers can view media library (for assignment) but not upload
CREATE POLICY "Managers can view media library"
  ON public.media_library FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Managers can assign media to buses
CREATE POLICY "Managers can assign media to buses"
  ON public.media_library FOR INSERT
  TO authenticated
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

-- Step 3: Instructions for creating manager users
-- You need to create users through the Supabase Auth system first, then assign roles
-- 
-- To create a manager user:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" and create a new user with email/password
-- 3. Copy the user ID from the created user
-- 4. Run the following query with the actual user ID:

-- Example: Assign manager role to existing user
-- Replace 'USER_ID_HERE' with the actual user ID from auth.users
/*
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES ('USER_ID_HERE', 'manager', NOW())
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- Step 4: Verify the setup
SELECT 
    p.email,
    p.full_name,
    ur.role,
    ur.created_at as role_assigned_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'manager'
ORDER BY ur.created_at DESC;
