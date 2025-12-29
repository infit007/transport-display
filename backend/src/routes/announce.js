import { Router } from 'express';

// In-memory last announced landmark per bus
// Stores: busId -> { name, stage }
const lastAnnouncedMap = new Map();

// Build Overpass QL query for landmarks within radius
function buildOverpassQuery(lat, lng, radius = 1000) {
  // Target tags: railway station, bus station, airport, hospital, college, temple, mall, market
  // OSM tags used:
  // - railway=station
  // - amenity=bus_station
  // - aeroway=aerodrome
  // - amenity=hospital
  // - amenity=college (and university for broader coverage)
  // - amenity=place_of_worship
  // - shop=mall
  // - amenity=marketplace
  return `
    [out:json][timeout:15];
    (
      nwr(around:${radius},${lat},${lng})[railway=station];
      nwr(around:${radius},${lat},${lng})[amenity=bus_station];
      nwr(around:${radius},${lat},${lng})[aeroway=aerodrome];
      nwr(around:${radius},${lat},${lng})[amenity=hospital];
      nwr(around:${radius},${lat},${lng})[amenity=college];
      nwr(around:${radius},${lat},${lng})[amenity=university];
      nwr(around:${radius},${lat},${lng})[amenity=place_of_worship];
      nwr(around:${radius},${lat},${lng})[shop=mall];
      nwr(around:${radius},${lat},${lng})[amenity=marketplace];
    );
    out center tags 30;
  `;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Reusable helper to perform detection and emit the announcement
async function fetchOverpassWithFallback(query) {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  const timeoutMs = 12000;

  for (const url of endpoints) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), timeoutMs);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ data: query }).toString(),
          signal: controller.signal,
        });
        clearTimeout(to);
        if (resp.ok) {
          return await resp.json();
        }
        // Backoff on rate limits/5xx
        await new Promise((r) => setTimeout(r, 500 + attempt * 500));
      } catch (_e) {
        // brief delay then try next attempt or mirror
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }
  throw new Error('All Overpass mirrors failed');
}

export async function detectAndAnnounceLandmark(io, { busId, lat, lng, force = false }) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const busKey = (busId ?? '').toString().trim();
  if (!busKey || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { ok: false, error: 'Invalid payload' };
  }

  const query = buildOverpassQuery(latNum, lngNum, 1000);
  let json = null;
  try {
    json = await fetchOverpassWithFallback(query);
  } catch (e) {
    if (force) {
      // Emit a test announcement even if Overpass is down
      const busKey = (busId ?? '').toString().trim();
      const fallbackName = lastAnnouncedMap.get(busKey)?.name || `Location (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
      const stage = 'REACHED';
      lastAnnouncedMap.set(busKey, { name: fallbackName, stage });
      const payload = { type: 'LANDMARK', name: fallbackName, busId: busKey, stage };
      try {
        io.to(`bus:${busKey}`).emit('announce:landmark', payload);
        io.emit('announce:landmark', payload);
      } catch {}
      return { ok: true, announced: true, name: fallbackName, stage, reason: 'forced_without_overpass' };
    }
    // Degrade gracefully: avoid surfacing 502 to clients
    return { ok: true, announced: false, reason: 'overpass_failed' };
  }

  const elements = Array.isArray(json?.elements) ? json.elements : [];
  let best = null;
  for (const el of elements) {
    const name = el?.tags?.name || el?.tags?.['name:en'] || null;
    if (!name) continue;
    const c = el.center || (el.type === 'node' ? { lat: el.lat, lon: el.lon } : null);
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
    const d = haversineMeters(latNum, lngNum, c.lat, c.lon);
    if (!best || d < best.distance) best = { name, distance: d };
  }

  if (!best) {
    return { ok: true, announced: false };
  }

  const stage = best.distance <= 150 ? 'REACHED' : 'APPROACHING';
  const last = lastAnnouncedMap.get(busKey);
  if (!force && last && last.name === best.name && last.stage === stage) {
    return { ok: true, announced: false, name: best.name, stage };
  }

  lastAnnouncedMap.set(busKey, { name: best.name, stage });
  const payload = { type: 'LANDMARK', name: best.name, busId: busKey, stage };

  try {
    io.to(`bus:${busKey}`).emit('announce:landmark', payload);
    io.emit('announce:landmark', payload);
  } catch {}

  return { ok: true, announced: true, name: best.name, stage };
}

export default function createAnnounceRoutes(io) {
  const router = Router();

  router.post('/announce-gps', async (req, res) => {
    try {
      const { busId, lat, lng, force = false } = req.body || {};
      const result = await detectAndAnnounceLandmark(io, { busId, lat, lng, force });
      // Always return 200 for client resilience; pass through announced flag/reason
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}
