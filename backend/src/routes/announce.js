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
    out center tags 50;
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

export default function createAnnounceRoutes(io) {
  const router = Router();

  router.post('/announce-gps', async (req, res) => {
    try {
      const { busId, lat, lng } = req.body || {};
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const busKey = (busId ?? '').toString().trim();
      if (!busKey || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return res.status(400).json({ error: 'Invalid payload: { busId, lat, lng } required' });
      }

      // Query Overpass API
      const query = buildOverpassQuery(latNum, lngNum, 1000);
      const overpassUrl = 'https://overpass-api.de/api/interpreter';

      let json = null;
      try {
        const resp = await fetch(overpassUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ data: query }).toString(),
        });
        if (!resp.ok) {
          return res.status(502).json({ error: `Overpass error: ${resp.status}` });
        }
        json = await resp.json();
      } catch (e) {
        return res.status(502).json({ error: 'Overpass request failed' });
      }

      const elements = Array.isArray(json?.elements) ? json.elements : [];
      // Choose nearest with a human-friendly name
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
        return res.json({ ok: true, announced: false });
      }

      // Determine stage based on distance
      const stage = best.distance <= 150 ? 'REACHED' : 'APPROACHING';

      // De-dup by name + stage so we can announce APPROACHING then REACHED once each
      const last = lastAnnouncedMap.get(busKey);
      if (last && last.name === best.name && last.stage === stage) {
        return res.json({ ok: true, announced: false, name: best.name, stage });
      }

      // Update in-memory map
      lastAnnouncedMap.set(busKey, { name: best.name, stage });

      const payload = { type: 'LANDMARK', name: best.name, busId: busKey, stage };

      try {
        // Emit to specific bus room if TVs joined with bus number
        io.to(`bus:${busKey}`).emit('announce:landmark', payload);
        // Also emit globally as a fallback
        io.emit('announce:landmark', payload);
      } catch {}

      return res.json({ ok: true, announced: true, name: best.name, stage });
    } catch (e) {
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}
