# 🔧 Fix Media Library Upload Error

## ❌ **Problem**
Your friend gets this error when uploading videos:
```
new row violates row-level security policy for table "media_library"
```

## ✅ **Solution**

### **Step 1: Fix Database Policies**

Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Enable RLS and create proper policies for media_library
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to media_library" ON media_library;
DROP POLICY IF EXISTS "Allow authenticated users to insert media" ON media_library;
DROP POLICY IF EXISTS "Allow authenticated users to update media" ON media_library;
DROP POLICY IF EXISTS "Allow authenticated users to delete media" ON media_library;

-- Create new policies
CREATE POLICY "Allow public read access to media_library" ON media_library
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert media" ON media_library
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update media" ON media_library
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete media" ON media_library
    FOR DELETE
    TO authenticated
    USING (true);
```

### **Step 2: Fix Storage Policies**

In your Supabase dashboard, go to **Storage** → **Policies** and add these policies:

```sql
-- Allow public read access to media files
CREATE POLICY "Allow public read access to media files" ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'media-library');

-- Allow authenticated users to upload media files
CREATE POLICY "Allow authenticated users to upload media files" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'media-library');

-- Allow authenticated users to update media files
CREATE POLICY "Allow authenticated users to update media files" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'media-library');

-- Allow authenticated users to delete media files
CREATE POLICY "Allow authenticated users to delete media files" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'media-library');
```

### **Step 3: Check Storage Bucket**

Make sure you have a storage bucket named `media-library`:
1. Go to **Storage** in Supabase dashboard
2. If the bucket doesn't exist, create it
3. Make sure it's **public** (for TV display app access)

## 🎯 **Why This Happens**

- **Your PC**: You're probably logged in as an admin/owner
- **Friend's PC**: They're logged in as a regular user
- **RLS Policies**: The current policies are too restrictive for regular users

## ✅ **After Fix**

- ✅ **Your friend can upload videos** without errors
- ✅ **TV Display App can access videos** from the database
- ✅ **All users can manage media** properly
- ✅ **Security is maintained** with proper authentication

## 📝 **Quick Test**

After applying the fixes:
1. Have your friend try uploading a video again
2. Check the TV Display App to see if videos load
3. Verify the media appears in the Media Library

The error should be completely resolved! 🎉
