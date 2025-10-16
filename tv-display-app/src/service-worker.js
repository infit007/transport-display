/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { setCacheNameDetails } from 'workbox-core';

// Set custom cache names
setCacheNameDetails({
  prefix: 'tv-display',
  suffix: 'v1',
  precache: 'precache',
  runtime: 'runtime'
});

self.skipWaiting();
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Pre-cache the HTML shell so navigations work offline even on first reload
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open('html-shell');
      // Use cache: 'reload' to bypass any HTTP caches
      await cache.add(new Request('/index.html', { cache: 'reload' }));
      await cache.add(new Request('/', { cache: 'reload' }));
    } catch {}
  })());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Accept warm-up caching requests from the app
self.addEventListener('message', (event) => {
  try {
    const data = event?.data || {};
    if (data && data.type === 'CACHE_URLS' && Array.isArray(data.urls) && data.urls.length) {
      event.waitUntil((async () => {
        const cache = await caches.open('pre-warm');
        const requests = data.urls
          .filter(Boolean)
          .map((u) => new Request(u, { mode: 'no-cors' }));
        try { await cache.addAll(requests); } catch {}
      })());
    }
  } catch {}
});

// App shell: serve HTML with NetworkFirst + fallback to cached index.html when offline
registerRoute(({ request }) => request.mode === 'navigate', async ({ request, event }) => {
  const strategy = new NetworkFirst({
    cacheName: 'html-shell',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 })]
  });
  try {
    return await strategy.handle({ request, event });
  } catch {
    try {
      const cache = await caches.open('html-shell');
      const cached = await cache.match('/index.html');
      if (cached) return cached;
    } catch {}
    return Response.error();
  }
});

// Cache API content with network-first strategy
registerRoute(
  ({ url }) => url.pathname.includes('/api/content'),
  new NetworkFirst({
    cacheName: 'api-content',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60 // 5 minutes
      })
    ]
  })
);

// Cache backend API used by the app (buses, media, news)
registerRoute(
  ({ url }) => url.origin === 'https://transport-display.onrender.com' && (
    url.pathname.startsWith('/api/buses') ||
    url.pathname.startsWith('/api/media') ||
    url.pathname.startsWith('/api/news') ||
    url.pathname.startsWith('/api/health')
  ),
  new NetworkFirst({
    cacheName: 'api-backend',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 10 * 60 })
    ]
  })
);

// Cache images with cache-first strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// Cache videos with range request support (for partial fetches on replay/seek)
registerRoute(
  ({ request }) => request.destination === 'video',
  new CacheFirst({
    cacheName: 'videos',
    plugins: [
      new RangeRequestsPlugin(),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 14 * 24 * 60 * 60 })
    ]
  })
);

// Cache other assets with stale-while-revalidate
registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources'
  })
);

// Mapbox GL assets (styles/tiles/fonts)
registerRoute(
  ({ url }) => url.origin === 'https://api.mapbox.com',
  new CacheFirst({
    cacheName: 'mapbox-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })
    ]
  })
);




