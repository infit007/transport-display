# TV Display App - Supabase Configuration

## The Problem
The TV Display App is showing "Loading..." and getting 401 Unauthorized errors because it's using an invalid Supabase API key.

## The Solution
The app now includes a **Supabase Configuration** step that will appear when you first load the TV Display App.

## How to Configure

### Step 1: Get Your Supabase Credentials
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **"Settings"** → **"API"**
4. Copy these two values:
   - **Project URL** (looks like: `https://eunaapesqbukbsrbgwna.supabase.co`)
   - **anon public** key (looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### Step 2: Configure the TV Display App
1. Open the TV Display App in your browser
2. You'll see a **"Supabase Configuration"** screen
3. Enter the **Project URL** and **anon public** key
4. Click **"Configure Supabase"**
5. The page will refresh and you should see the bus selector

### Step 3: Select Bus and Depot
1. Enter a bus number (e.g., `UK-05-H-8001`)
2. Enter a depot name (e.g., `Kashipur Depot`)
3. Click **"Start Display"**

## Expected Results
After configuration, the TV Display App should:
- ✅ Load real bus data from the database
- ✅ Show correct route information for each bus
- ✅ Display real-time GPS coordinates
- ✅ Show actual news feeds
- ✅ Load bus-specific media content

## Troubleshooting
- If you still see "Loading...", check the browser console for errors
- Make sure you're using the correct **anon public** key (not the service_role key)
- The key should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

## Files Updated
- `tv-display-app/src/services/supabase.js` - Fixed Supabase configuration
- `tv-display-app/src/components/SupabaseConfig.jsx` - Added configuration UI
- `tv-display-app/src/App.jsx` - Added configuration step
- `tv-display-app/src/components/Display.jsx` - Fixed data loading logic
