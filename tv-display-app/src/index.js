import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
// Initialize passive landmark announcements listener (no UI/logic changes)
import './modules/landmarkListener.js';
// Initialize overlay controller to pause ads and show on-screen message for 5s
import './modules/landmarkOverlay.js';
// Expose dev helpers to the browser console for local testing
import './modules/devExpose.js';
// Auto-send geolocation changes to backend for announcements (no UI changes)
import './modules/autoAnnounceGps.js';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

// Register service worker only when a SW file actually exists (prevents 404 in dev)
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
if ('serviceWorker' in navigator && !isLocalhost) {
  try {
    const tryRegister = async () => {
      try {
        const resp = await fetch('/service-worker.js', { method: 'HEAD' });
        if (resp && resp.ok) {
          await navigator.serviceWorker.register('/service-worker.js');
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            try { window.location.reload(); } catch {}
          });
        }
      } catch {}
    };
    // kick off without blocking render
    tryRegister();
  } catch {}
}


