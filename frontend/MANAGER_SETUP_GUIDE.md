# 🔐 Manager Role Setup Guide

## 📋 **Step-by-Step Instructions**

### **Step 1: Access Supabase Dashboard**
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your FleetSignage project
4. Navigate to **SQL Editor** in the left sidebar

### **Step 2: Run the Migration**
1. Copy the contents of `MANAGER_ROLE_SETUP.sql`
2. Paste it into the SQL Editor
3. Click **Run** to execute the migration

### **Step 3: Handle Enum Value Addition**
If you get an error about adding enum values, run this separately:

```sql
-- Add manager role to enum (run this first if needed)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
```

Then run the rest of the migration.

### **Step 4: Create Manager Users**

#### **Option A: Create New Manager Account**
```sql
-- Create a new manager user
INSERT INTO public.profiles (id, email, full_name, created_at)
VALUES (
    gen_random_uuid(),
    'your-manager@email.com',
    'Manager Name',
    NOW()
);

-- Assign manager role
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
    p.id,
    'manager',
    NOW()
FROM public.profiles p
WHERE p.email = 'your-manager@email.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

#### **Option B: Convert Existing User to Manager**
```sql
-- Find existing user
SELECT id, email FROM public.profiles WHERE email = 'existing@email.com';

-- Assign manager role (replace with actual user ID)
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES (
    'USER_ID_FROM_ABOVE_QUERY',
    'manager',
    NOW()
)
ON CONFLICT (user_id, role) DO NOTHING;
```

### **Step 5: Verify Setup**
Run this query to verify everything is working:

```sql
-- Check all users with manager role
SELECT 
    p.email,
    p.full_name,
    ur.role,
    ur.created_at as role_assigned_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'manager'
ORDER BY ur.created_at DESC;
```

### **Step 6: Test Manager Portal**
1. Go to your application
2. Click "Manager Portal" on the homepage
3. Login with manager credentials
4. Verify you can access `/manager/dashboard`
5. Confirm you cannot see "Media Library" in the sidebar

## 🔍 **Troubleshooting**

### **Common Issues:**

#### **1. "role does not exist" Error**
```sql
-- Check available roles
SELECT DISTINCT role FROM public.user_roles;
```

#### **2. "Cannot add enum value in transaction"**
Run the enum addition separately:
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
```

#### **3. User Cannot Access Manager Portal**
Check if user has the correct role:
```sql
SELECT 
    p.email,
    ur.role
FROM public.profiles p
JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email = 'user@email.com';
```

#### **4. RLS Policy Errors**
Verify policies exist:
```sql
-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND policyname LIKE '%Manager%';
```

## ✅ **Expected Results**

After successful setup:
- ✅ Manager role exists in `app_role` enum
- ✅ RLS policies allow manager access to appropriate tables
- ✅ Manager users can login and access `/manager/dashboard`
- ✅ Manager users cannot access Media Library
- ✅ Manager users can assign existing media to buses
- ✅ Manager users can create and broadcast news

## 🎯 **Manager Portal Features**

Once set up, managers will have access to:
- **Dashboard**: Fleet and news statistics
- **Fleet Management**: View-only bus monitoring
- **News Feeds**: Create news and assign existing media

**Restricted from:**
- Media Library (upload/delete media)
- Bus configuration changes
- Admin-only settings

## 📞 **Support**

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify RLS policies are correctly applied
3. Ensure user has proper role assignment
4. Test with a fresh browser session
