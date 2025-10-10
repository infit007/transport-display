const CACHE = 'fleetsignage-v1';
const ASSETS = ['/','/index.html','/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept cross-origin requests (e.g., Supabase, Render socket, maps)
  if (url.origin !== self.location.origin) {
    return; // let the network handle it
  }

  // Bypass caching for socket.io and any non-GET requests
  if (url.pathname.startsWith('/socket.io') || request.method !== 'GET') {
    return; // do not respondWith; fall through to network
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});


