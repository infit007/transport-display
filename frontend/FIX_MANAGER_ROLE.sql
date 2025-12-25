-- Fix Manager Role Assignment
-- Run this in Supabase SQL Editor

-- Step 1: Check if the user exists in auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'manager@fleetsignage.com';

-- Step 2: Check if the user has a profile
SELECT p.id, p.email, p.full_name 
FROM public.profiles p 
WHERE p.email = 'manager@fleetsignage.com';

-- Step 3: Check current roles for this user
SELECT 
    p.email,
    ur.role,
    ur.created_at as role_assigned_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email = 'manager@fleetsignage.com';

-- Step 4: Assign manager role (replace USER_ID with actual ID from Step 1)
-- First, get the user ID from the query above, then run this:

-- Example (replace the UUID with the actual user ID):
/*
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES ('REPLACE_WITH_ACTUAL_USER_ID', 'manager', NOW())
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- Step 5: Verify the role assignment
SELECT 
    p.email,
    p.full_name,
    ur.role,
    ur.created_at as role_assigned_at
FROM public.profiles p
JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email = 'manager@fleetsignage.com';
