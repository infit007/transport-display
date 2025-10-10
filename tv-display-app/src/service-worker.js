/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache GET requests to CMS content endpoints lightly
registerRoute(({ url }) => /\/api\/content/.test(url.pathname), new StaleWhileRevalidate());



