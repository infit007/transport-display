import { Router } from 'express';

// In-memory last announced landmark per bus
// Stores: busId -> { name, stage, ts }
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

export async function detectAndAnnounceLandmark(io, { busId, lat, lng, force = false }, supabase = null) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const busKey = (busId ?? '').toString().trim();
  if (!busKey || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { ok: false, error: 'Invalid payload' };
  }

  // 1) If custom midpoints exist for this bus, prefer them over Overpass
  if (supabase) {
    try {
      const { data: mps } = await supabase
        .from('route_midpoints')
        .select('id,name,lat,lng,radius_m,order_index,active')
        .eq('bus_number', busKey)
        .eq('active', true)
        .order('order_index', { ascending: true });

      // Also pull start/end points from buses table, if coordinates exist
      const { data: busRow } = await supabase
        .from('buses')
        .select('start_point,end_point,start_latitude,start_longitude,end_latitude,end_longitude')
        .eq('bus_number', busKey)
        .maybeSingle();

      const candidates = Array.isArray(mps) ? [...mps] : [];
      if (busRow) {
        if (Number.isFinite(busRow?.start_latitude) && Number.isFinite(busRow?.start_longitude)) {
          candidates.unshift({
            id: 'start',
            name: busRow.start_point || 'Start',
            lat: Number(busRow.start_latitude),
            lng: Number(busRow.start_longitude),
            radius_m: 150,
            order_index: -2,
            active: true,
          });
        }
        if (Number.isFinite(busRow?.end_latitude) && Number.isFinite(busRow?.end_longitude)) {
          candidates.push({
            id: 'end',
            name: busRow.end_point || 'End',
            lat: Number(busRow.end_latitude),
            lng: Number(busRow.end_longitude),
            radius_m: 150,
            order_index: 999999,
            active: true,
          });
        }
      }

      if (Array.isArray(candidates) && candidates.length > 0) {
        let best = null;
        for (const mp of candidates) {
          const d = haversineMeters(latNum, lngNum, Number(mp.lat), Number(mp.lng));
          const r = Number(mp.radius_m) || 150;
          const withinApproach = d <= 500; // announce only when within 500m of any configured point
          if (!withinApproach) continue;
          if (!best || d < best.distance) {
            const label = mp.name && String(mp.name).trim()
              ? String(mp.name)
              : `Midpoint ${Number(mp.order_index ?? 0) + 1}`;
            best = { name: label, distance: d, radius: r };
          }
        }

        if (!best) {
          return { ok: true, announced: false, reason: 'no_midpoint_within_radius' };
        }

        const stage = best.distance <= (best.radius || 150) ? 'REACHED' : 'APPROACHING';
        const nowTs = Date.now();
        const last = lastAnnouncedMap.get(busKey);
        if (!force && last && last.name === best.name && last.stage === stage) {
          if (stage === 'REACHED') {
            // Allow continuous repeats for REACHED every ~2.5s
            if ((nowTs - (last.ts || 0)) < 2500) {
              return { ok: true, announced: false, name: best.name, stage };
            }
            // proceed
          } else {
            // APPROACHING: suppress duplicates
            return { ok: true, announced: false, name: best.name, stage };
          }
        }

        lastAnnouncedMap.set(busKey, { name: best.name, stage, ts: nowTs });
        const payload = { type: 'LANDMARK', name: best.name, busId: busKey, stage };
        try {
          io.to(`bus:${busKey}`).emit('announce:landmark', payload);
          io.emit('announce:landmark', payload);
        } catch {}
        return { ok: true, announced: true, name: best.name, stage };
      }
    } catch {}
  }

  // 2) No custom midpoints configured for this bus; do not use Overpass anymore
  return { ok: true, announced: false, reason: 'no_midpoints_configured' };
}

export default function createAnnounceRoutes(io, supabase = null) {
  const router = Router();

  router.post('/announce-gps', async (req, res) => {
    try {
      const { busId, lat, lng, force = false } = req.body || {};
      const result = await detectAndAnnounceLandmark(io, { busId, lat, lng, force }, supabase);
      // Always return 200 for client resilience; pass through announced flag/reason
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // Public: get active midpoints for a bus (ordered)
  router.get('/midpoints/public/:busNumber', async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ ok: false, error: 'supabase_unavailable' });
      const busNumber = String(req.params.busNumber || '').trim();
      if (!busNumber) return res.status(400).json({ ok: false, error: 'missing_bus_number' });
      const { data, error } = await supabase
        .from('route_midpoints')
        .select('id,name,lat,lng,radius_m,order_index,active')
        .eq('bus_number', busNumber)
        .eq('active', true)
        .order('order_index', { ascending: true });
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.json({ ok: true, items: data || [] });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'unexpected' });
    }
  });

  return router;
}
