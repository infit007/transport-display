# 🔐 Give Suraj Singh Full Access

## 👤 **User Details**
- **Name**: Suraj Singh
- **Email**: suraj.r87@gmail.com
- **UID**: `fa403eb0-56bc-406f-a50f-30462ac29893`

## ✅ **Step 1: Run This SQL in Supabase Dashboard**

Go to your Supabase dashboard → **SQL Editor** and run:

```sql
-- Give Suraj Singh full access to the system
-- First, ensure Suraj Singh exists in the profiles table
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

-- Give Suraj Singh admin role
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES (
    'fa403eb0-56bc-406f-a50f-30462ac29893',
    'admin',  -- Change this to your actual admin role name
    NOW()
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the user has been granted access
SELECT 
    p.full_name,
    p.email,
    ur.role,
    ur.created_at as role_granted_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.id = 'fa403eb0-56bc-406f-a50f-30462ac29893';
```

## 🔍 **Step 2: Check Available Roles**

If you're not sure what roles exist, run this query first:

```sql
-- Check what roles are available in your system
SELECT DISTINCT role FROM public.user_roles;
```

## 🎯 **Step 3: Verify Access**

After running the SQL, Suraj Singh should have:
- ✅ **Full admin access** to the dashboard
- ✅ **Can upload videos** without RLS errors
- ✅ **Can manage buses** and routes
- ✅ **Can access all features** in the system

## 📝 **Common Role Names**

Based on your schema, you might have these roles:
- `admin` - Full system access
- `operator` - Can manage buses and routes
- `manager` - Can view reports and manage users
- `user` - Basic access

## 🔧 **If You Get Errors**

1. **"role does not exist"**: Check what roles are available with the query above
2. **"user not found"**: The profile might not exist, the SQL will create it
3. **"permission denied"**: You might need to run this as a superuser

## ✅ **After Setup**

Suraj Singh will be able to:
- Upload videos to Media Library
- Manage buses and routes
- Access all dashboard features
- No more RLS policy errors

The access should be granted immediately! 🎉
