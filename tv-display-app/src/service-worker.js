/* eslint-disable no-restricted-globals */

// Minimal, framework-agnostic service worker (no Workbox runtime dependency)

// Reference to please Workbox InjectManifest during build; we don't actually use it
// but the presence of this symbol allows the build to succeed on Vercel.
// eslint-disable-next-line no-undef
const __WB_MANIFEST_PLACEHOLDER = self.__WB_MANIFEST || [];

const CACHE_SHELL = 'html-shell-v1';
const CACHE_IMAGES = 'images-v1';
const CACHE_VIDEOS = 'videos-v1';
const CACHE_STATIC = 'static-v1';
const CACHE_API = 'api-v1';

self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pre-cache shell for offline navigation
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);
    try {
      await cache.add(new Request('/index.html', { cache: 'reload' }));
      await cache.add(new Request('/', { cache: 'reload' }));
    } catch {}
  })());
});

// Message channel for cache warmup/purge
self.addEventListener('message', (event) => {
  const data = event?.data || {};
  if (data?.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      for (const url of data.urls) {
        try {
          const lower = String(url).toLowerCase();
          const isVideo = /\.(mp4|webm|ogg|avi|mov)(\?.*)?$/.test(lower);
          const isImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(lower);
          const bucket = isVideo ? CACHE_VIDEOS : (isImage ? CACHE_IMAGES : CACHE_STATIC);
          const cache = await caches.open(bucket);
          const req = new Request(url, { mode: 'no-cors' });
          const hit = await cache.match(req);
          if (!hit) {
            const res = await fetch(req).catch(() => null);
            if (res) try { await cache.put(req, res.clone()); } catch {}
          }
        } catch {}
      }
    })());
  }
  if (data?.type === 'PURGE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const buckets = [CACHE_VIDEOS, CACHE_IMAGES, CACHE_STATIC];
      const targets = data.urls.map((u) => { try { const x = new URL(u); x.search=''; return x.toString(); } catch { return u; } });
      for (const name of buckets) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        for (const req of keys) {
          const normalized = req.url.split('?')[0];
          if (targets.includes(normalized) || targets.includes(req.url)) {
            try { await cache.delete(req); } catch {}
          }
        }
      }
    })());
  }
});

// Navigation: Network-first with shell fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only cache GET requests. Let HEAD/POST/etc pass through untouched.
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  // HTML navigations
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(CACHE_SHELL);
        try { cache.put('/index.html', net.clone()); } catch {}
        return net;
      } catch {
        const cache = await caches.open(CACHE_SHELL);
        return (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Backend API: Network-first short TTL
  if (/\/api\//.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_API);
      try {
        const net = await fetch(req);
        try { cache.put(req, net.clone()); } catch {}
        return net;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        throw new Error('offline');
      }
    })());
    return;
  }

  // Videos: cache-first; bypass CORS issues by avoiding cache.put on opaque responses
  if (req.destination === 'video' || /\.(mp4|webm|ogg|avi|mov)(\?.*)?$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VIDEOS);
      // Normalize request to GET without HEAD (some CDNs respond with opaque)
      const normalizedReq = new Request(req.url, { method: 'GET', mode: 'no-cors' });
      const hit = await cache.match(normalizedReq);
      if (hit) return hit;
      try {
        const net = await fetch(normalizedReq);
        // Only cache non-opaque successful responses
        try { if (net && net.type !== 'opaque') { await cache.put(normalizedReq, net.clone()); } } catch {}
        return net;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  // Images & static: stale-while-revalidate
  if (req.destination === 'image' || /\.(png|jpe?g|gif|webp|svg|css|js)(\?.*)?$/.test(url.pathname)) {
    event.respondWith((async () => {
      const isImage = req.destination === 'image' || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(url.pathname);
      const bucket = isImage ? CACHE_IMAGES : CACHE_STATIC;
      const cache = await caches.open(bucket);
      const hit = await cache.match(req);
      const fetchAndUpdate = fetch(req).then((res) => { try { cache.put(req, res.clone()); } catch {} return res; }).catch(() => null);
      return hit || (await fetchAndUpdate) || Response.error();
    })());
    return;
  }
});




