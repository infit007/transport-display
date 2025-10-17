import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

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


