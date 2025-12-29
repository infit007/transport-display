import io from 'socket.io-client';
import { BACKEND_URL } from '../config/backend-simple.js';

if (typeof window !== 'undefined') {
  if (!window.io) {
    window.io = io;
  }
  if (!window.BACKEND_URL) {
    window.BACKEND_URL = BACKEND_URL;
  }
  if (!window.testGPS) {
    window.testGPS = (payload = {}) => {
      const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      socket.emit('gps:update', payload);
      return true;
    };
  }
  if (!window.testAnnounce) {
    window.testAnnounce = async ({ busId, lat, lng }) => {
      const r = await fetch(`${BACKEND_URL}/api/announce-gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busId, lat, lng })
      });
      return r.json();
    };
  }
}
