# Mapbox Setup Instructions

## Getting a Free Mapbox Access Token

1. **Sign up for Mapbox**: Go to [https://mapbox.com](https://mapbox.com) and create a free account
2. **Get your access token**: 
   - Go to your [Mapbox account page](https://account.mapbox.com/)
   - Copy your "Default public token" (starts with `pk.`)
3. **Update the token**: Replace the placeholder token in `src/components/MapboxMap.jsx`:
   ```javascript
   const MAPBOX_ACCESS_TOKEN = 'your_actual_token_here';
   ```

## Features Implemented

✅ **Real Map Rendering**: Replaces the blank grey area with actual map tiles
✅ **Directions API**: Shows driving route from start to end location
✅ **Interactive Markers**: 
   - Green marker for start location
   - Red marker for end location  
   - Blue marker for current bus location
✅ **Route Visualization**: Blue line showing the actual driving route
✅ **Auto-fit Bounds**: Map automatically zooms to show the entire route
✅ **Popups**: Click markers to see location details

## Current Demo Token

The app currently uses a demo token that has limited usage. For production use, you should:
1. Get your own free Mapbox token (50,000 free requests/month)
2. Replace the token in the MapboxMap component
3. Deploy the updated app

## Map Features

- **Real-time GPS tracking** with moving bus marker
- **Route planning** using Mapbox Directions API
- **Interactive map** with zoom and pan controls
- **Responsive design** that works on TV displays
- **Professional styling** matching your app theme

The map will now show actual roads, landmarks, and provide accurate directions between your bus stops!
