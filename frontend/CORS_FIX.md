# CORS Issue Fix for TV Display App

## Problem
The TV Display App is getting "Failed to fetch" errors when trying to connect to the backend on Render. This is a **CORS (Cross-Origin Resource Sharing)** issue.

## Root Cause
The backend on Render (`https://transport-display.onrender.com`) is not configured to allow requests from the Vercel domain (`https://transport-display-q1oq.vercel.app`).

## Solution

### Step 1: Update Backend CORS Configuration
The backend server.js file has been updated to allow all origins temporarily:

```javascript
app.use(cors({ 
  origin: true, // Allow all origins for now
  credentials: true
}));
```

### Step 2: Deploy Backend Changes
You need to deploy the updated backend to Render:

1. **Commit the changes** to your git repository
2. **Push to the main branch** that Render is watching
3. **Render will automatically redeploy** the backend

### Step 3: Alternative - Set Environment Variable
If you prefer to be more specific, you can set the `CORS_ORIGIN` environment variable in Render:

1. Go to your Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Add: `CORS_ORIGIN=https://transport-display-q1oq.vercel.app,https://transport-display.vercel.app`

### Step 4: Test the Connection
After deploying, test the connection:

1. Open the TV Display App
2. Check the browser console
3. You should see successful API requests instead of "Failed to fetch" errors

## Current Status
- ✅ Backend endpoints are working (tested with curl)
- ✅ TV Display App is configured correctly
- ❌ CORS policy is blocking requests
- 🔄 Backend needs to be redeployed with CORS fix

## Expected Result
After fixing CORS, the TV Display App should:
- ✅ Load real bus data from the backend
- ✅ Show correct route information (UK-05-H-8001 → Pithoragarh - Champawat)
- ✅ Display real news feeds
- ✅ Load media content

## Files Updated
- `backend/src/server.js` - Updated CORS configuration
- `tv-display-app/src/services/api.js` - Added better error handling
