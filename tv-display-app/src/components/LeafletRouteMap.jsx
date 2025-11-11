import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Optional Turf (recommended but not required). Component falls back to WebMercator math.
let turfNearestPointOnLine = null;
let turfPoint = null;
let turfLineString = null;
try {
  // eslint-disable-next-line global-require
  const np = require('@turf/nearest-point-on-line').default || require('@turf/nearest-point-on-line');
  // eslint-disable-next-line global-require
  const helpers = require('@turf/helpers');
  turfNearestPointOnLine = np;
  turfPoint = helpers.point;
  turfLineString = helpers.lineString;
} catch (_) {
  // Turf not present; will use fallback projection.
}

// ---------------------------- Utilities ----------------------------
const toRad = (d) => (d * Math.PI) / 180;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lonLatToMercator(lon, lat) {
  const R = 6378137;
  const x = R * toRad(lon);
  const y = R * Math.log(Math.tan(Math.PI / 4 + (toRad(lat) / 2)));
  return { x, y };
}

function mercatorToLonLat(x, y) {
  const R = 6378137;
  const lon = (x / R) * 180 / Math.PI;
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
  return { lon, lat };
}

function projectPointToSegmentMeters(ax, ay, bx, by, px, py) {
  const A = lonLatToMercator(ax, ay);
  const B = lonLatToMercator(bx, by);
  const P = lonLatToMercator(px, py);
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const wx = P.x - A.x;
  const wy = P.y - A.y;
  const vlen2 = vx * vx + vy * vy;
  const tRaw = vlen2 === 0 ? 0 : ((wx * vx + wy * vy) / vlen2);
  const t = Math.max(0, Math.min(1, tRaw));
  const x = A.x + vx * t;
  const y = A.y + vy * t;
  const proj = mercatorToLonLat(x, y);
  const dist = Math.hypot(P.x - x, P.y - y);
  return { t, lng: proj.lon, lat: proj.lat, dist };
}

function computeCumDistances(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i += 1) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    cum.push(cum[i - 1] + haversineMeters(lat1, lng1, lat2, lng2));
  }
  return cum;
}

function projectToRoute(coords, cumDistances, lat, lng, DEBUG = false) {
  if (!coords || coords.length < 2) return null;
  // Validate that lat and lng are valid numbers
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Validate that coords array contains valid numbers
  if (!coords.every(c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))) {
    return null;
  }
  if (turfNearestPointOnLine && turfPoint && turfLineString) {
    try {
      const line = turfLineString(coords);
      const p = turfPoint([lng, lat]);
      const nearest = turfNearestPointOnLine(line, p, { units: 'kilometers' });
      if (nearest && nearest.geometry) {
        const projLng = nearest.geometry.coordinates[0];
        const projLat = nearest.geometry.coordinates[1];
        const props = nearest.properties || {};
        const distanceToRoute = Number(props.distance ?? props.dist ?? 0) * 1000; // km→m
        const idx = Math.max(0, (props.index ?? 1) - 1);
        const loc = Number(props.location ?? 0);
        const segLen = (cumDistances[idx + 1] ?? 0) - (cumDistances[idx] ?? 0);
        const alongDistance = (cumDistances[idx] ?? 0) + (segLen || 0) * loc;
        if (DEBUG) console.debug('[LeafletRouteMap][turf]', { projLng, projLat, distanceToRoute, alongDistance, idx, loc });
        return { point: [projLng, projLat], alongDistance, distanceToRoute };
      }
    } catch (e) {
      // Turf failed, fall through to fallback projection
      if (DEBUG) console.warn('[LeafletRouteMap] Turf projection failed, using fallback', e);
    }
  }

  // Fallback projection in meters (WebMercator)
  let best = { dist: Infinity, segIndex: 0, t: 0, lng, lat };
  for (let i = 0; i < coords.length - 1; i += 1) {
    const [lngA, latA] = coords[i];
    const [lngB, latB] = coords[i + 1];
    const proj = projectPointToSegmentMeters(lngA, latA, lngB, latB, lng, lat);
    if (proj.dist < best.dist) {
      best = { dist: proj.dist, segIndex: i, t: proj.t, lng: proj.lng, lat: proj.lat };
    }
  }
  const segLen = (cumDistances[best.segIndex + 1] ?? 0) - (cumDistances[best.segIndex] ?? 0);
  const alongDistance = (cumDistances[best.segIndex] ?? 0) + (segLen || 0) * best.t;
  const distanceToRoute = best.dist;
  if (DEBUG) console.debug('[LeafletRouteMap][fallback]', best, { alongDistance, distanceToRoute });
  return { point: [best.lng, best.lat], alongDistance, distanceToRoute };
}

function smoothSpeed(prev, current, alpha = 0.25) {
  if (!Number.isFinite(current) || current <= 0) return prev ?? null;
  return prev == null ? current : alpha * current + (1 - alpha) * prev;
}

function formatETA(seconds) {
  if (!Number.isFinite(seconds) || seconds == null || seconds < 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function formatMeters(m) {
  if (!Number.isFinite(m) || m == null) return '—';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

export default function LeafletRouteMap({
  startLocation,
  endLocation,
  currentLocation,
  stops = [],
  busNumber = '',
  routeGeojson = null,
  osrmUrl = 'https://router.project-osrm.org',
  follow = true,
  DEBUG = false,
  forceEtaFallback = false,
}) {
  const mapRef = useRef(null);
  const mapElRef = useRef(null);
  const routeLayerRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const projDebugMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]);
  const cumDistancesRef = useRef([]);
  const routeCoordsRef = useRef([]);
  const totalMetersRef = useRef(0);
  const hasFitRouteOnceRef = useRef(false);
  const userInteractedRef = useRef(false);
  const recentPositionsRef = useRef([]);
  const smoothedSpeedRef = useRef(null);
  const lastRouteStartRef = useRef(null); // Track last route start point to avoid unnecessary recalculations

  const [lastSeen, setLastSeen] = useState('');
  const [etaToDest, setEtaToDest] = useState(null);
  const [remainingMeters, setRemainingMeters] = useState(null);
  const [stopEtas, setStopEtas] = useState([]);

  const effectiveStops = useMemo(() => {
    if (Array.isArray(stops) && stops.length > 0) return stops;
    const hasStart = !!(startLocation && Number.isFinite(startLocation.lat) && Number.isFinite(startLocation.lng));
    const hasEnd = !!(endLocation && Number.isFinite(endLocation.lat) && Number.isFinite(endLocation.lng));
    if (hasStart && hasEnd) {
      return [
        { lat: startLocation.lat, lng: startLocation.lng, name: startLocation.name || 'Start' },
        { lat: endLocation.lat, lng: endLocation.lng, name: endLocation.name || 'End' },
      ];
    }
    return [];
  }, [stops, startLocation, endLocation]);

  // Init map
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true, attributionControl: false, preferCanvas: true });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Ensure the map has an initial center/zoom to avoid "Set map center and zoom first" during early interactions
    try { map.setView([20.5937, 78.9629], 6, { animate: false }); } catch {}

    // detect manual interaction; keep follow but don't change zoom automatically
    try {
      map.on('zoomstart', () => { userInteractedRef.current = true; });
      map.on('dragstart', () => { userInteractedRef.current = true; });
    } catch {}

    // Ensure proper sizing after mount and on container resizes
    try {
      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 0);
      if (typeof ResizeObserver !== 'undefined' && mapElRef.current) {
        const ro = new ResizeObserver(() => { try { map.invalidateSize(); } catch {} });
        ro.observe(mapElRef.current);
        // store on ref for cleanup
        mapElRef.current.__ro = ro;
      }
      window.addEventListener('resize', () => { try { map.invalidateSize(); } catch {} });
    } catch {}

    return () => {
      try { window.removeEventListener('resize', () => { try { map.invalidateSize(); } catch {} }); } catch {}
      try { mapElRef.current && mapElRef.current.__ro && mapElRef.current.__ro.disconnect(); } catch {}
      try { map.remove(); } catch {}
      mapRef.current = null;
    };
  }, []);

  // Load route (OSRM or injected)
  // Always calculate route from startLocation to endLocation (the planned route)
  // currentLocation is only used for the vehicle marker position, not the route calculation
  useEffect(() => {
    let aborted = false;
    async function loadRoute() {
      try {
        let coords = null;
        if (routeGeojson && Array.isArray(routeGeojson.coordinates)) {
          coords = routeGeojson.coordinates;
        } else {
          // Always use startLocation to endLocation for the route (planned route)
          const validStart = startLocation && Number.isFinite(startLocation.lat) && Number.isFinite(startLocation.lng);
          const validEnd = endLocation && Number.isFinite(endLocation.lat) && Number.isFinite(endLocation.lng);
          if (!validStart || !validEnd) return;
          
          // Only recalculate route if start/end locations have changed significantly
          const lastStart = lastRouteStartRef.current;
          const routeKey = `${startLocation.lat.toFixed(4)},${startLocation.lng.toFixed(4)}-${endLocation.lat.toFixed(4)},${endLocation.lng.toFixed(4)}`;
          const lastRouteKey = lastRouteStartRef.current?.routeKey;
          
          if (lastRouteKey === routeKey && routeCoordsRef.current.length > 0) {
            // Route hasn't changed, keep existing route
            return;
          }
          
          // Update last route info
          lastRouteStartRef.current = { 
            lat: startLocation.lat, 
            lng: startLocation.lng,
            routeKey 
          };
          
          const url = `${osrmUrl.replace(/\/+$/,'')}/route/v1/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`OSRM ${resp.status}`);
          const json = await resp.json();
          coords = json?.routes?.[0]?.geometry?.coordinates || null;
        }
        if (aborted || !Array.isArray(coords) || coords.length < 2) return;

        routeCoordsRef.current = coords;
        cumDistancesRef.current = computeCumDistances(coords);
        totalMetersRef.current = cumDistancesRef.current[cumDistancesRef.current.length - 1] || 0;

        if (routeLayerRef.current) { try { routeLayerRef.current.remove(); } catch {} routeLayerRef.current = null; }
        routeLayerRef.current = L.polyline(coords.map(([lng, lat]) => [lat, lng]), {
          color: '#17a2ff', weight: 6, opacity: 0.95
        }).addTo(mapRef.current);

        // Fit to the route once; afterwards, respect user's zoom level
        if (!hasFitRouteOnceRef.current) {
          const bounds = L.latLngBounds(coords.map(([lng, lat]) => [lat, lng]));
          mapRef.current.fitBounds(bounds, { padding: [40, 40] });
          hasFitRouteOnceRef.current = true;
        }

        // stops
        stopMarkersRef.current.forEach((e) => { try { e.marker.remove(); e.label.remove(); } catch {} });
        stopMarkersRef.current = effectiveStops.map((s) => {
          const m = L.marker([s.lat, s.lng]).addTo(mapRef.current);
          const label = L.marker([s.lat, s.lng], {
            icon: L.divIcon({
              className: 'stop-eta',
              html: `<div style="background:rgba(0,0,0,.7);color:#fff;padding:4px 6px;border-radius:4px;font-size:12px;">ETA: —</div>`
            })
          }).addTo(mapRef.current);
          return { marker: m, label, info: { name: s.name, lat: s.lat, lng: s.lng, along: 0 } };
        });

        // Precompute along for stops
        stopMarkersRef.current = stopMarkersRef.current.map((entry) => {
          // Validate stop coordinates before projecting
          if (!Number.isFinite(entry.info.lat) || !Number.isFinite(entry.info.lng)) {
            return { ...entry, info: { ...entry.info, along: 0 } };
          }
          const proj = projectToRoute(coords, cumDistancesRef.current, entry.info.lat, entry.info.lng, DEBUG);
          return { ...entry, info: { ...entry.info, along: proj?.alongDistance || 0 } };
        });
      } catch (e) {
        if (DEBUG) console.warn('[LeafletRouteMap] route load failed', e);
      }
    }
    if (mapRef.current) loadRoute();
    return () => { aborted = true; };
  }, [startLocation, endLocation, osrmUrl, routeGeojson, effectiveStops, DEBUG]);

  // GPS updates
  useEffect(() => {
    if (!mapRef.current || !currentLocation || routeCoordsRef.current.length < 2) return;
    // Validate that currentLocation has valid coordinates
    if (!Number.isFinite(currentLocation.lat) || !Number.isFinite(currentLocation.lng)) return;
    
    const ts = Number.isFinite(currentLocation.ts) ? currentLocation.ts : Date.now();
    recentPositionsRef.current.push({ lat: currentLocation.lat, lng: currentLocation.lng, ts });
    if (recentPositionsRef.current.length > 6) recentPositionsRef.current.shift();

    if (!vehicleMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'width:28px;height:28px;border-radius:50%;background:#ff4d4f;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);';
      vehicleMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: L.divIcon({ className: 'vehicle', html: `<div style="width:28px;height:28px;border-radius:50%;background:#ff4d4f;border:2px solid #fff;"></div>` })
      }).addTo(mapRef.current);
    }

    // project
    const proj = projectToRoute(routeCoordsRef.current, cumDistancesRef.current, currentLocation.lat, currentLocation.lng, DEBUG);
    if (!proj) return;
    const [projLng, projLat] = proj.point;

    // speed smoothing
    let inst = null;
    const buffs = recentPositionsRef.current;
    if (buffs.length >= 2) {
      const a = buffs[buffs.length - 2];
      const b = buffs[buffs.length - 1];
      const dt = Math.max(0.001, (b.ts - a.ts) / 1000);
      inst = haversineMeters(a.lat, a.lng, b.lat, b.lng) / dt;
    }
    smoothedSpeedRef.current = smoothSpeed(smoothedSpeedRef.current, inst ?? 0);
    let speed = smoothedSpeedRef.current;
    if (!Number.isFinite(speed) || speed <= 0) speed = forceEtaFallback ? 6 : null;

    const remain = Math.max(0, (totalMetersRef.current || 0) - (proj.alongDistance || 0));
    setRemainingMeters(remain);
    setEtaToDest(speed ? remain / speed : null);

    // per-stop ETAs
    const updStops = stopMarkersRef.current.map((e) => {
      const r = Math.max(0, (e.info.along || 0) - (proj.alongDistance || 0));
      const etaS = speed ? r / speed : null;
      try {
        const el = e.label.getElement();
        el.innerHTML = `<div style="background:rgba(0,0,0,.7);color:#fff;padding:4px 6px;border-radius:4px;font-size:12px;">
          ${etaS == null ? 'ETA: —' : `ETA ${formatETA(etaS)}`} • ${formatMeters(r)}
        </div>`;
      } catch {}
      return { name: e.info.name, remainingMeters: Math.round(r), etaSeconds: etaS == null ? null : Math.round(etaS) };
    });
    setStopEtas(updStops);

    // move vehicle (authoritative projection)
    try { vehicleMarkerRef.current.setLatLng([projLat, projLng]); } catch {}
    if (follow) {
      try {
        const z = mapRef.current.getZoom();
        // keep current zoom (respect manual zoom), just pan smoothly towards target
        mapRef.current.setView([projLat, projLng], z, { animate: true });
      } catch {}
    }

    // debug marker
    if (DEBUG) {
      try {
        if (!projDebugMarkerRef.current) {
          projDebugMarkerRef.current = L.circleMarker([projLat, projLng], { radius: 6, color: '#00e0ff', weight: 2, fillColor: '#00e0ff', fillOpacity: 0.8 }).addTo(mapRef.current);
        } else {
          projDebugMarkerRef.current.setLatLng([projLat, projLng]);
        }
        // eslint-disable-next-line no-console
        console.debug('[LeafletRouteMap] gps=', currentLocation, 'proj=', proj, 'remain=', remain, 'total=', totalMetersRef.current, 'speed=', speed);
      } catch {}
    }

    // last seen
    try {
      const d = new Date(ts);
      setLastSeen(d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }));
    } catch { setLastSeen(''); }
  }, [currentLocation, follow, DEBUG, forceEtaFallback]);

  const panelStyle = {
    position: 'absolute',
    right: 12,
    bottom: 12,
    minWidth: 260,
    maxWidth: 340,
    background: 'rgba(0,0,0,0.72)',
    color: '#fff',
    padding: '12px 14px',
    borderRadius: 10,
    fontFamily: 'Inter, Roboto, Arial, sans-serif',
    zIndex: 450,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapElRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={panelStyle}>
        <div style={{ fontSize: 12, color: '#bbb' }}>BUS</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{busNumber || '—'}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <div>Coords</div>
          <div>{currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : '—'}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
          <div>ETA</div>
          <div>{formatETA(etaToDest)}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
          <div>To Dest</div>
          <div>{remainingMeters == null ? '—' : `${(remainingMeters / 1000).toFixed(1)} km`}</div>
        </div>

        <div style={{ fontSize: 12, color: '#bbb', marginTop: 10 }}>Next Stops</div>
        <div style={{ maxHeight: 140, overflowY: 'auto', marginTop: 6 }}>
          {stopEtas.length === 0 ? (
            <div style={{ fontSize: 12, color: '#ccc' }}>No stops</div>
          ) : stopEtas.map((s) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 13 }}>
              <div>{s.name}</div>
              <div style={{ textAlign: 'right' }}>
                <div>{formatETA(s.etaSeconds)}</div>
                <div style={{ fontSize: 11, color: '#bbb' }}>{s.remainingMeters != null ? `${(s.remainingMeters/1000).toFixed(1)} km` : ''}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#bbb', marginTop: 8 }}>Last: {lastSeen || '—'}</div>
      </div>
    </div>
  );
}

