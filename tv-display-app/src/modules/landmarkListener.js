import io from 'socket.io-client';
import { BACKEND_URL } from '../config/backend-simple.js';

// Keep last announced place names to avoid repeats within session
const spoken = new Set();

function speak(text) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-IN';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    // Best-effort: cancel queued items to avoid backlog
    try { window.speechSynthesis.cancel(); } catch {}
    window.speechSynthesis.speak(utter);
  } catch {}
}

export function initLandmarkAnnouncements() {
  try {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on('announce:landmark', (payload) => {
      try {
        if (!payload || payload.type !== 'LANDMARK') return;
        const name = (payload.name || '').trim();
        if (!name) return;
        if (spoken.has(name)) return; // de-duplicate within session
        spoken.add(name);
        speak(`We are approaching ${name}`);
      } catch {}
    });

    // No further side effects; this module only listens
    return socket;
  } catch (e) {
    // Silent fail to avoid impacting existing UI/logic
    return null;
  }
}

// Auto-initialize on import so callers can just import the module once
initLandmarkAnnouncements();
