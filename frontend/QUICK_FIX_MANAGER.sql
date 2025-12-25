-- Quick Fix: Assign Manager Role
-- Run this in Supabase SQL Editor

-- This will assign manager role to the user if they exist
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
    p.id,
    'manager',
    NOW()
FROM public.profiles p
WHERE p.email = 'manager@fleetsignage.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the assignment worked
SELECT 
    p.email,
    p.full_name,
    ur.role,
    ur.created_at as role_assigned_at
FROM public.profiles p
JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email = 'manager@fleetsignage.com';
