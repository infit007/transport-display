import { BACKEND_URL } from '../config/backend-simple.js';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function extractBusNumberFromDom() {
  try {
    // Prefer explicit data attribute if present
    const elAttr = document.querySelector('[data-bus-number]');
    if (elAttr && elAttr.getAttribute('data-bus-number')) return elAttr.getAttribute('data-bus-number');

    // Look for text elements that contain a likely bus number pattern
    // Use word boundaries to avoid swallowing trailing/leading letters (e.g., 'rUK-07-...')
    const rx = /\b[A-Z]{1,3}-?\d{1,2}-?[A-Z]{0,2}-?\d{3,5}\b/;
    const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,div,span,p,strong,b'));
    for (const el of candidates) {
      const t = (el.textContent || '').toUpperCase();
      const m = t.match(rx);
      if (m && m[0]) {
        const v = m[0].toUpperCase().trim();
        return v;
      }
    }
  } catch {}
  return null;
}

function resolveBusNumber() {
  // 1) Manual override
  if (typeof window !== 'undefined' && window.BUS_NUMBER) return String(window.BUS_NUMBER);
  // 2) Query params
  try {
    const sp = new URLSearchParams(window.location.search);
    const qp = sp.get('bus') || sp.get('busNumber') || sp.get('bus_number');
    if (qp) return qp;
  } catch {}
  // 3) localStorage
  try {
    const ls = localStorage.getItem('busNumber') || localStorage.getItem('bus_number');
    if (ls) return ls;
  } catch {}
  // 4) DOM text extraction
  const dom = extractBusNumberFromDom();
  if (dom) return dom;
  return null;
}

async function postAnnounce(busId, lat, lng, force = false) {
  try {
    console.debug('[autoAnnounce] POST /announce-gps', { busId, lat, lng, force });
    const r = await fetch(`${BACKEND_URL}/api/announce-gps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busId, lat, lng, force }),
    });
    const json = await r.json();
    console.debug('[autoAnnounce] announce response', json);
    return json;
  } catch (e) {
    console.debug('[autoAnnounce] announce network error', e);
    return { ok: false, error: 'network' };
  }
}

export function initAutoAnnounceGps() {
  try {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return null;

    let busId = resolveBusNumber();
    if (busId) console.debug('[autoAnnounce] initial busId', busId);
    // Expose a setter for manual override while testing
    if (!window.setBusNumber) {
      window.setBusNumber = (val) => {
        busId = String(val || '').trim() || null;
        console.debug('[autoAnnounce] setBusNumber ->', busId);
        // If we now have a busId and cached coords, fire the first forced post immediately
        try {
          if (busId && lastLat != null && lastLng != null && firstPost === true) {
            const forceNow = true; // ensure first post is forced
            firstPost = false;
            postAnnounce(busId, lastLat, lastLng, forceNow);
          }
        } catch {}
        return busId;
      };
    }

    if (!busId) {
      // Retry busId resolution once after load (DOM might not be ready yet)
      setTimeout(() => {
        busId = resolveBusNumber();
        console.debug('[autoAnnounce] delayed busId', busId);
        // If busId just resolved and we have a cached position, trigger forced post
        try {
          if (busId && lastLat != null && lastLng != null && firstPost === true) {
            const forceNow = true;
            firstPost = false;
            postAnnounce(busId, lastLat, lastLng, forceNow);
          }
        } catch {}
      }, 2000);
    }

    let lastLat = null;
    let lastLng = null;
    let lastAt = 0;
    let firstPost = true; // force on first location after reload
    const isAlwaysForce = () => {
      try {
        if (typeof window !== 'undefined' && window.ANNOUNCE_ALWAYS_FORCE) return true;
        const v = localStorage.getItem('announce_always_force');
        return v === '1' || v === 'true';
      } catch {}
      return false;
    };

    const minMeters = 50;      // ignore tiny jitter
    const minInterval = 5000;  // at most every 5s

    const onPos = async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = Date.now();

        console.debug('[autoAnnounce] geolocation pos', { lat, lng });
        // Debounce small movements irrespective of busId so we retain last known position
        if (lastLat != null && lastLng != null) {
          const moved = haversineMeters(lastLat, lastLng, lat, lng);
          if (moved < minMeters && (now - lastAt) < minInterval) return;
        }

        // Always cache latest location so we can announce once busId appears
        lastLat = lat; lastLng = lng; lastAt = now;

        // If bus number isn't ready yet, schedule a short retry using cached coords
        if (!busId) {
          console.debug('[autoAnnounce] busId missing, scheduling retry');
          setTimeout(() => {
            try {
              if (!busId) return;
              const forceNow = firstPost === true || isAlwaysForce();
              firstPost = false;
              postAnnounce(busId, lastLat, lastLng, forceNow);
            } catch {}
          }, 1200);
          return;
        }

        const force = firstPost === true || isAlwaysForce();
        firstPost = false;
        postAnnounce(busId, lat, lng, force);
      } catch {}
    };

    const onErr = (e) => {
      // Silent; retry a one-shot read after a short delay if timeout (code 3)
      if (e && Number(e.code) === 3) {
        setTimeout(() => {
          try {
            navigator.geolocation.getCurrentPosition(onPos, () => {}, {
              enableHighAccuracy: false,
              maximumAge: 10000,
              timeout: 15000,
            });
          } catch {}
        }, 2000);
      }
    };

    // Seed once (faster UX) with relaxed constraints
    try {
      navigator.geolocation.getCurrentPosition(onPos, onErr, {
        enableHighAccuracy: false,
        maximumAge: 10000,
        timeout: 15000,
      });
    } catch {}

    // Continuous updates with generous timeout and cached values allowed
    const watchId = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: false,
      maximumAge: 10000,
      timeout: 30000,
    });

    return () => { try { navigator.geolocation.clearWatch(watchId); } catch {} };
  } catch (e) {
    return null;
  }
}

// Auto-init
initAutoAnnounceGps();
