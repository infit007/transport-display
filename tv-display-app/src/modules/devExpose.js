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
  if (!window.flipRoute) {
    window.flipRoute = async (busNumber) => {
      console.group('[flipRoute]');
      console.log('Backend URL:', BACKEND_URL);
      console.log('busNumber:', busNumber);
      try {
        const r = await fetch(`${BACKEND_URL}/api/buses/flip/public`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ busNumber })
        });
        const txt = await r.text();
        console.log('HTTP status:', r.status);
        console.log('Raw body:', txt);
        try { console.log('Parsed JSON:', JSON.parse(txt)); } catch {}
        console.groupEnd();
        return { ok: r.ok, status: r.status, body: txt };
      } catch (e) {
        console.error('flipRoute error:', e);
        console.groupEnd();
        throw e;
      }
    };
  }
  if (!window.flipRouteVerbose) {
    window.flipRouteVerbose = async (busNumber) => {
      const qs = new URLSearchParams(window.location.search);
      const id = busNumber || window.localStorage.getItem('tv_bus_number') || qs.get('deviceId');
      console.group('[flipRouteVerbose]');
      console.log('Resolved busNumber:', id);
      console.log('Backend URL:', BACKEND_URL);
      try {
        const r = await fetch(`${BACKEND_URL}/api/buses/flip/public`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ busNumber: id })
        });
        const txt = await r.text();
        console.log('HTTP status:', r.status);
        console.log('Response body:', txt);
        try { console.log('JSON:', JSON.parse(txt)); } catch {}
        // Read back snapshot to confirm swap
        try {
          const r2 = await fetch(`${BACKEND_URL}/api/buses/public/${encodeURIComponent(id)}?_cb=${Date.now()}`);
          const j2 = await r2.json();
          console.log('Post-flip snapshot:', j2?.start_point, '->', j2?.end_point);
        } catch (e) { console.warn('Snapshot fetch failed', e); }
        console.groupEnd();
        return { ok: r.ok, status: r.status, body: txt };
      } catch (e) {
        console.error('flipRouteVerbose error:', e);
        console.groupEnd();
        throw e;
      }
    };
  }
}
