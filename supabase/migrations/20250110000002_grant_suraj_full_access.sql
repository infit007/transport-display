-- Give Suraj Singh full access to the system
-- Suraj Singh UID: fa403eb0-56bc-406f-a50f-30462ac29893

-- First, let's check if Suraj Singh exists in the profiles table
-- If not, we need to create a profile entry
INSERT INTO public.profiles (id, email, full_name, created_at)
VALUES (
    'fa403eb0-56bc-406f-a50f-30462ac29893',
    'suraj.r87@gmail.com',
    'Suraj Singh',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

-- Now give Suraj Singh admin role (assuming you have an 'admin' role)
-- You may need to adjust the role name based on your actual role enum values
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES (
    'fa403eb0-56bc-406f-a50f-30462ac29893',
    'admin',  -- Change this to your actual admin role name
    NOW()
)
ON CONFLICT (user_id, role) DO NOTHING;

-- If you have multiple roles, you can add them all:
-- INSERT INTO public.user_roles (user_id, role, created_at)
-- VALUES 
--     ('fa403eb0-56bc-406f-a50f-30462ac29893', 'admin', NOW()),
--     ('fa403eb0-56bc-406f-a50f-30462ac29893', 'operator', NOW()),
--     ('fa403eb0-56bc-406f-a50f-30462ac29893', 'manager', NOW())
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the user has been granted access
SELECT 
    p.full_name,
    p.email,
    ur.role,
    ur.created_at as role_granted_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.id = 'fa403eb0-56bc-406f-a50f-30462ac29893';
