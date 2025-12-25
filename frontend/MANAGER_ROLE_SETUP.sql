-- FleetSignage Manager Role Migration
-- Run this in your Supabase Dashboard → SQL Editor

-- Step 1: Add manager role to the app_role enum
-- Note: PostgreSQL doesn't allow adding enum values in a transaction, so this might need to be run separately
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

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

-- Step 3: Create a sample manager user (optional)
-- Replace with actual manager email
INSERT INTO public.profiles (id, email, full_name, created_at)
VALUES (
    gen_random_uuid(),
    'manager@fleetsignage.com',
    'Manager User',
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name;

-- Step 4: Assign manager role to the sample user
-- Note: You'll need to get the actual user ID from auth.users table
-- This is just an example - replace with actual user ID
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
    p.id,
    'manager',
    NOW()
FROM public.profiles p
WHERE p.email = 'manager@fleetsignage.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 5: Verify the setup
SELECT 
    p.email,
    p.full_name,
    ur.role,
    ur.created_at as role_assigned_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'manager'
ORDER BY ur.created_at DESC;
