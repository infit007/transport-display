import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

// Request persistent storage so the browser is less likely to evict large cached videos
try {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(() => {
      try { navigator.storage.estimate().then(info => console.log('Storage quota:', info)); } catch {}
    }).catch(() => {});
  }
} catch {}

// Register service worker early (Workbox InjectManifest outputs service-worker.js at site root)
if ('serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      try { navigator.serviceWorker.register('service-worker.js').catch(() => {}); } catch {}
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      try { window.location.reload(); } catch {}
    });
  } catch {}
}


