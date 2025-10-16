import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

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


