-- Create Manager User - Manual Steps
-- Run this AFTER completing Step 1 and Step 2

-- Method 1: Create user through Supabase Dashboard (RECOMMENDED)
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" 
-- 3. Enter email: manager@fleetsignage.com
-- 4. Enter password: (choose a secure password)
-- 5. Click "Create user"
-- 6. Copy the User ID from the created user

-- Method 2: Create user via SQL (if you have admin access)
-- Replace 'your-password-here' with a secure password
/*
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'manager@fleetsignage.com',
    crypt('your-password-here', gen_salt('bf')),
    NOW(),
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Manager User"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);
*/

-- Step 3: Assign manager role to existing user
-- Replace 'USER_ID_FROM_AUTH_USERS' with the actual user ID
-- You can find this by running: SELECT id, email FROM auth.users WHERE email = 'manager@fleetsignage.com';

-- Example (uncomment and replace USER_ID):
/*
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES ('USER_ID_FROM_AUTH_USERS', 'manager', NOW())
ON CONFLICT (user_id, role) DO NOTHING;
*/

-- Step 4: Verify the manager user was created
SELECT 
    au.email,
    au.created_at as user_created_at,
    p.full_name,
    ur.role,
    ur.created_at as role_assigned_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE au.email = 'manager@fleetsignage.com';
