# MIME Type Error Fix for TV Display App

## Problem
The TV Display App is showing "The script has an unsupported MIME type ('text/html')" error. This happens when the browser tries to load a JavaScript file but receives an HTML page instead.

## Root Cause
The issue was in the `vercel.json` configuration. The catch-all route `{ "src": "/.*", "dest": "/index.html" }` was redirecting **all requests** (including JavaScript files) to the HTML file, causing the browser to receive HTML instead of JavaScript.

## Solution Applied

### Fixed Vercel Configuration
Updated `tv-display-app/vercel.json` to properly serve static files:

```json
{
  "buildCommand": "npm install && npm run build",
  "outputDirectory": "dist",
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*\\.js|.*\\.css|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.json)", "dest": "/$1" },
    { "src": "/.*", "dest": "/index.html" }
  ]
}
```

### What This Fix Does
1. **`"handle": "filesystem"`** - Serves static files from the dist directory
2. **Static file route** - Matches common file extensions and serves them directly
3. **Fallback route** - Only redirects non-file requests to index.html

## Files Updated
- ✅ `tv-display-app/vercel.json` - Fixed routing configuration
- ✅ `tv-display-app/src/services/api.js` - Enhanced error handling
- ✅ `backend/src/server.js` - Fixed CORS configuration

## Next Steps

### 1. Deploy TV Display App to Vercel
The updated configuration needs to be deployed:
```bash
# Commit and push changes
git add tv-display-app/vercel.json
git commit -m "Fix MIME type error - proper static file serving"
git push origin main
```

### 2. Deploy Backend CORS Fix
The backend also needs the CORS fix deployed:
```bash
git add backend/src/server.js
git commit -m "Fix CORS for TV Display App"
git push origin main
```

## Expected Results After Deployment

### Before Fix:
- ❌ "The script has an unsupported MIME type ('text/html')"
- ❌ "Failed to fetch" CORS errors
- ❌ App shows "Loading..." indefinitely

### After Fix:
- ✅ JavaScript files load with correct MIME type
- ✅ API requests work (after CORS fix)
- ✅ Real bus data displays (UK-05-H-8001 → Pithoragarh - Champawat)
- ✅ News feeds and media content load properly

## Technical Details

### MIME Type Issue
- **Problem**: Browser requests `bundle.164918db837e509d0f64.js`
- **Got**: HTML content (index.html)
- **Expected**: JavaScript content with `application/javascript` MIME type

### CORS Issue
- **Problem**: Backend blocks cross-origin requests from Vercel
- **Solution**: Updated CORS to allow all origins temporarily

Both issues need to be fixed for the TV Display App to work properly!
