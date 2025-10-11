# 🔧 Mapbox Token Fix Instructions

## ❌ **Current Issue**
The Mapbox access token is invalid, causing 401 Unauthorized errors and showing a blank grey map.

## ✅ **Quick Fix Steps**

### **Option 1: Get Your Own Free Mapbox Token (Recommended)**

1. **Sign up**: Go to [https://mapbox.com](https://mapbox.com) and create a free account
2. **Get token**: Go to [https://account.mapbox.com/](https://account.mapbox.com/) and copy your "Default public token"
3. **Update code**: Replace the token in `src/components/MapboxMap.jsx` line 18:
   ```javascript
   const MAPBOX_ACCESS_TOKEN = 'your_actual_token_here';
   ```
4. **Rebuild**: Run `npm run build`
5. **Deploy**: Push changes to see the real map

### **Option 2: Use OpenStreetMap Fallback (Current)**

The app now automatically falls back to OpenStreetMap tiles when Mapbox fails, so you should see:
- ✅ **Real map tiles** (OpenStreetMap)
- ✅ **Blue route line** between start and end points
- ✅ **Interactive markers** for all locations
- ✅ **Working map** without needing a Mapbox token

## 🎯 **What You'll See After Fix**

- **Real map tiles** with roads, buildings, terrain
- **Blue route line** showing the path between bus stops
- **Green marker** for start location (Pithoragarh)
- **Red marker** for end location (Champawat)
- **Blue marker** for current bus location
- **Interactive map** you can zoom and pan

## 📝 **Current Status**

The app now has **error handling** that:
1. **Tries Mapbox first** (if you have a valid token)
2. **Falls back to OpenStreetMap** if Mapbox fails
3. **Shows a straight line route** if directions API fails
4. **Always shows a working map** regardless of token issues

The map should now work immediately with OpenStreetMap tiles!
