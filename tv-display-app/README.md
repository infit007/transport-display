# TV Display App (PWA)

React PWA optimized for Android TV signage. Connects to your MERN CMS for registration and content.

## Features
- One-time registration (device name, location, approval code) -> POST /api/register-device
- Stores JWT/token and deviceId in localStorage
- Enters fullscreen automatically
- Pulls content from GET /api/content?deviceId=...
- Realtime updates via Socket.io
- Offline caching of static assets with Workbox

## Quick start
```bash
cd tv-display-app
npm install
npm run start
```
Open on TV at http://<host>:8081

Set CMS base URL (optional during dev):
```js
localStorage.setItem('CMS_BASE_URL', 'http://localhost:4000');
```

## Build
```bash
npm run build
npm run serve:prod
```

## Android TV APK (free options)

Option A: PWABuilder
1. Deploy the PWA (any HTTPS host). Ensure manifest.json is reachable.
2. Visit https://www.pwabuilder.com, enter your PWA URL.
3. Generate Android package (TWA). Download the Android Studio project.
4. Open in Android Studio (free), set package id and signing (debug ok), Build > Build Bundle(s)/APK(s).

Option B: Capacitor (community/free)
```bash
npm install --save-dev @capacitor/cli
npm install @capacitor/android
npx cap init tv-display-app com.example.tvdisplay --web-dir=dist
npm run build
npx cap add android
npx cap copy android
npx cap open android
# Build APK from Android Studio
```

## Environment
- BASE URL is taken from localStorage CMS_BASE_URL or process.env.CMS_BASE_URL or defaults to http://localhost:4000
- Backend endpoints expected:
  - POST /api/register-device -> { token, deviceId }
  - GET /api/content?deviceId=... -> { items: [...], ticker }
  - GET /api/auth/validate -> 200 if token valid
  - Socket: content:update (optional payload { deviceId })

## Hidden admin mode
Implement a remote key sequence in Display.jsx as desired (e.g., up-up-down-down-left-right-left-right). Currently not mapped.
