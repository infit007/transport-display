import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/*
  MapboxMap with:
   - realtime smooth marker
   - ETA to destination + mid-stops (based on route geometry)
   - speed estimation from recent positions
   Props:
     - startLocation {lat,lng,name}
     - endLocation {lat,lng,name}
     - currentLocation {lat,lng,ts}  // ts in ms
     - stops: [{lat,lng,name}]       // optional: intermediate stops along the route in order
     - journeyProgress   (0..1)      // optional: kept for camera following
     - busNumber
*/

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

// --- geometry helpers (no external deps) ---
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Project point p onto segment ab, return { t, x, y, dist } where t in [0,1] is fraction along segment
function projectPointToSegment(ax, ay, bx, by, px, py) {
  // convert lat/lng to simple equirectangular coords for small-dist projection (accurate enough for projection)
  // But to compute t we can do vector arithmetic in lat/lng space directly.
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const vlen2 = vx * vx + vy * vy;
  if (vlen2 === 0) return { t: 0, x: ax, y: ay, dist: haversineMeters(py, px, ay, ax) };
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vlen2));
  const x = ax + vx * t;
  const y = ay + vy * t;
  const dist = haversineMeters(py, px, y, x);
  return { t, x, y, dist };
}

// Given a route (array of [lng,lat]), compute cumulative distances (meters) along it
function computeCumulativeDistances(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const d = haversineMeters(lat1, lng1, lat2, lng2);
    cum.push(cum[i - 1] + d);
  }
  return cum; // same length as coords; cum[0] = 0, cum[last] = total length
}

// Project arbitrary lat/lng onto route polyline; return { nearestIndex, segIndex, t, alongDistance, distanceToRoute, point: [lng,lat] }
function projectPointToRoute(routeCoords, cumDist, lat, lng) {
  let best = { distanceToRoute: Infinity, segIndex: 0, t: 0, point: null, alongDistance: 0 };
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [lngA, latA] = routeCoords[i];
    const [lngB, latB] = routeCoords[i + 1];
    const proj = projectPointToSegment(lngA, latA, lngB, latB, lng, lat);
    if (proj.dist < best.distanceToRoute) {
      best.distanceToRoute = proj.dist;
      best.segIndex = i;
      best.t = proj.t;
      best.point = [proj.x, proj.y];
      // alongDistance = cumDist[i] + t * segmentLength
      const segLen = cumDist[i + 1] - cumDist[i];
      best.alongDistance = cumDist[i] + proj.t * segLen;
    }
  }
  return best;
}

function formatMeters(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
function formatETA(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rmins = mins % 60;
  return `${hrs}h ${rmins}m`;
}

// --- component ---
const MapboxMap = ({ startLocation, endLocation, currentLocation, stops = [], journeyProgress = 0, busNumber }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const routeCoordsRef = useRef([]); // array of [lng,lat]
  const cumDistRef = useRef([]); // cumulative distances along route
  const totalRouteMetersRef = useRef(0);
  const routeSourceAddedRef = useRef(false);

  // marker and stop refs
  const vehicleMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]); // { marker, etaLabelId }

  // recent positions for speed estimation: [{lat,lng,ts}]
  const recentPosRef = useRef([]);

  // UI state
  const [placeName, setPlaceName] = useState('');
  const [lastSeenStr, setLastSeenStr] = useState('');
  const [etaToDestination, setEtaToDestination] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [stopEtas, setStopEtas] = useState([]); // [{ name, remainingMeters, etaSeconds }]

  // configuration
  const defaultSpeedMps = 8.3333; // 30 km/h ~ 8.33 m/s - fallback when vehicle stationary or not enough samples
  const speedSamples = 4; // number of recent samples for speed estimation
  const smoothingFactor = 0.25; // marker interpolation smoothing

  // Initialize map (preserves your original OSM raster style)
  useEffect(() => {
    if (map.current) return;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : (startLocation ? [startLocation.lng, startLocation.lat] : [78.9629, 20.5937]),
      zoom: 12,
      attributionControl: false,
      interactive: true
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      try { map.current.resize(); } catch {}
    });

    return () => {
      try { map.current.remove(); map.current = null; } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When route geometry becomes available (via start/end or OSRM), add source/layer and compute cumulative distances
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    // We expect previous effect that adds route to set routeCoordsRef (your existing addDirections must set map source 'route')
    // But this component also supports being passed a route directly via route coords if you want.
    // We'll try to read the route source if present:
    try {
      const src = map.current.getSource && map.current.getSource('route');
      if (src && !routeSourceAddedRef.current) {
        // attempt to read the coords from the source data
        const style = map.current.getStyle();
        // Safely attempt to read layer 'route' geojson - if the source was added by Display's effect, we fetch the feature
        const data = src._data || (src.serialize && src.serialize()); // internal fallback - may not always be available
        // Instead, read from style object where we added it earlier (map.getStyle may include it)
        // We'll prefer to read routeCoordsRef if the parent (Display) sets it via props by re-adding source.
      }
    } catch (e) {
      // ignore - we'll rely on routeCoordsRef being set by parent if applicable
    }
  }, [mapLoaded]);

  // Utility to set route coords explicitly (call from parent by making start/end set the route in map and then set this state)
  // We'll watch startLocation & endLocation and try to fetch OSRM ourselves if needed (same logic you had before)
  useEffect(() => {
    if (!mapLoaded || !map.current || !startLocation || !endLocation) return;

    let mounted = true;
    async function loadRouteAndCompute() {
      // Only use OSRM - no fallbacks
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
      let coords = null;
      try {
        const resp = await fetch(osrmUrl);
        if (resp.ok) {
          const json = await resp.json();
          coords = json?.routes?.[0]?.geometry?.coordinates || null;
        }
      } catch (e) {
        console.error('OSRM route fetch failed:', e);
        // No fallback - return early if route cannot be computed
        return;
      }
      
      // Only proceed if we have valid route coordinates from OSRM
      if (!coords || !Array.isArray(coords) || coords.length < 2) {
        console.error('Invalid or empty route coordinates from OSRM');
        return;
      }

      if (!mounted) return;

      // update map source (replace if exists)
      try {
        if (map.current.getSource('route')) {
          map.current.getSource('route').setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords }
          });
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords }
            }
          });
          map.current.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#00e0ff', 'line-width': 5 }
          });
        }
      } catch (err) {
        // maybe layer exists; ignore
      }

      // store route coords and cumulative distances
      routeCoordsRef.current = coords;
      const cum = computeCumulativeDistances(coords);
      cumDistRef.current = cum;
      totalRouteMetersRef.current = cum[cum.length - 1] || 0;

      // place stop markers (clear any existing)
      stopMarkersRef.current.forEach(s => { try { s.marker.remove(); } catch {} });
      stopMarkersRef.current = [];

      // build stops: if user passed stops prop use them, else auto-generate from start/mid/end
      const usedStops = (stops && stops.length > 0)
        ? stops
        : [
            { lat: startLocation.lat, lng: startLocation.lng, name: (startLocation.name || 'Start') },
            // optionally you can inject midpoints if you know them
            { lat: endLocation.lat, lng: endLocation.lng, name: (endLocation.name || 'End') }
          ];

      // For each stop, compute its along-route distance by projecting to route
      const stopInfos = usedStops.map((s) => {
        const proj = projectPointToRoute(routeCoordsRef.current, cumDistRef.current, s.lat, s.lng);
        return {
          ...s,
          alongDistance: proj.alongDistance,
          distanceFromRoute: proj.distanceToRoute
        };
      });

      // add markers and small label placeholders for ETA (we create a DOM element for label)
      for (let si of stopInfos) {
        const el = document.createElement('div');
        el.className = 'stop-marker';
        el.style.background = '#ffffff';
        el.style.border = '2px solid #333';
        el.style.padding = '4px 6px';
        el.style.borderRadius = '6px';
        el.style.fontSize = '12px';
        el.style.whiteSpace = 'nowrap';
        el.innerText = si.name;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([si.lng, si.lat]).addTo(map.current);

        // ETA label: create a small overlay marker above the stop to display ETA
        const label = document.createElement('div');
        label.className = 'stop-eta';
        label.style.background = 'rgba(0,0,0,0.7)';
        label.style.color = 'white';
        label.style.fontSize = '11px';
        label.style.padding = '4px 6px';
        label.style.borderRadius = '4px';
        label.style.marginBottom = '6px';
        label.innerText = 'ETA: —';
        const labelMarker = new mapboxgl.Marker({ element: label, anchor: 'bottom' }).setLngLat([si.lng, si.lat]).addTo(map.current);

        stopMarkersRef.current.push({ marker, labelMarker, info: si });
      }

      // initialize stopEtas state (will be updated on location updates)
      setStopEtas(stopMarkersRef.current.map(s => ({ name: s.info.name, remainingMeters: null, etaSeconds: null })));

      // fit bounds once
      try {
        const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
        map.current.fitBounds(bounds, { padding: 60 });
      } catch {}

    }

    loadRouteAndCompute();

    return () => { mounted = false; };
    // Only reload when start/end coordinates actually change, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, startLocation?.lat, startLocation?.lng, endLocation?.lat, endLocation?.lng]);

  // Speed estimation helper
  function estimateSpeedMps() {
    const arr = recentPosRef.current.slice(-speedSamples);
    if (arr.length < 2) return null;
    let totalDist = 0;
    let totalTime = 0;
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const cur = arr[i];
      const d = haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng);
      const dt = Math.max(0.001, (cur.ts - prev.ts) / 1000); // sec
      totalDist += d;
      totalTime += dt;
    }
    if (totalTime <= 0) return null;
    return totalDist / totalTime;
  }

  // update marker smoothly (lerp between current and target)
  function smoothMoveMarker(marker, targetLngLat) {
    try {
      const el = marker.getElement();
      // read current lng/lat
      const current = marker.getLngLat();
      const camLng = current.lng;
      const camLat = current.lat;
      const t = smoothingFactor; // interpolation weight
      const newLng = camLng + (targetLngLat[0] - camLng) * t;
      const newLat = camLat + (targetLngLat[1] - camLat) * t;
      marker.setLngLat([newLng, newLat]);
    } catch {}
  }

  // main effect: run whenever currentLocation changes
  useEffect(() => {
    if (!mapLoaded || !map.current || !currentLocation || !routeCoordsRef.current || routeCoordsRef.current.length < 2) return;

    // push to recent positions
    recentPosRef.current.push({ lat: currentLocation.lat, lng: currentLocation.lng, ts: currentLocation.ts || Date.now() });
    // keep last N samples
    if (recentPosRef.current.length > 10) recentPosRef.current.shift();

    // ensure vehicle marker exists at initial location
    const initLngLat = [currentLocation.lng, currentLocation.lat];
    if (!vehicleMarkerRef.current) {
      const el = document.createElement('div');
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.background = '#ff4d4f';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = 'white';
      el.style.fontSize = '12px';
      el.innerText = busNumber ? (String(busNumber)) : '';
      vehicleMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(initLngLat).addTo(map.current);
    }

    // estimate speed
    let speed = estimateSpeedMps();
    if (!speed || !isFinite(speed) || speed < 0.5) { // if too small, fallback to default
      speed = defaultSpeedMps;
    }

    // find projection onto route
    const proj = projectPointToRoute(routeCoordsRef.current, cumDistRef.current, currentLocation.lat, currentLocation.lng);
    const along = proj.alongDistance || 0;
    const remainingToEnd = Math.max(0, (totalRouteMetersRef.current || 0) - along);

    // compute ETA to destination (seconds)
    const etaSec = remainingToEnd / speed;
    setEtaToDestination(etaSec);
    setDistanceToDestination(remainingToEnd);

    // update stop ETAs
    const stopEtaList = stopMarkersRef.current.map((s) => {
      const remaining = Math.max(0, (s.info.alongDistance || 0) - along);
      const eta = remaining <= 0 ? 0 : (remaining / speed);
      // update label DOM
      try {
        const labelEl = s.labelMarker.getElement();
        labelEl.innerText = remaining <= 1 ? 'Arriving' : `ETA ${formatETA(eta)} • ${formatMeters(remaining)}`;
      } catch {}
      return { name: s.info.name, remainingMeters: Math.round(remaining), etaSeconds: Math.round(eta) };
    });
    setStopEtas(stopEtaList);

    // update overlay last seen
    try {
      const ts = currentLocation.ts || Date.now();
      const d = new Date(ts);
      setLastSeenStr(d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }));
    } catch { setLastSeenStr(''); }

    // move vehicle marker smoothly toward projected point (use projection point for better snapping to route)
    const targetLngLat = proj.point ? proj.point : [currentLocation.lng, currentLocation.lat];
    try {
      // either smooth move or set directly if far
      if (vehicleMarkerRef.current) {
        // if distance large (>100m), jump directly to avoid long smoothing
        const cur = vehicleMarkerRef.current.getLngLat();
        const distNow = haversineMeters(cur.lat, cur.lng, targetLngLat[1], targetLngLat[0]);
        if (distNow > 120) {
          vehicleMarkerRef.current.setLngLat([targetLngLat[0], targetLngLat[1]]);
        } else {
          // smooth interpolation over several frames (requestAnimationFrame)
          smoothMoveMarker(vehicleMarkerRef.current, targetLngLat);
        }
      }
    } catch (e) {}

    // optionally pan map to vehicle if desired (comment/uncomment)
    try {
      map.current.easeTo({ center: targetLngLat, duration: 700, offset: [0, -60] });
    } catch {}

    // persist computed ETA & distances in overlay UI (done by state above)
  }, [mapLoaded, currentLocation]);

  // overlay & UI render
  const overlayStyle = {
    position: 'absolute',
    left: 12,
    bottom: 12,
    background: 'rgba(0,0,0,0.72)',
    color: '#fff',
    padding: '10px 12px',
    borderRadius: 10,
    zIndex: 3,
    minWidth: 220,
    fontFamily: 'Inter, Roboto, sans-serif'
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <div style={overlayStyle}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{busNumber ? `Bus ${busNumber}` : 'Vehicle'}</div>

        <div style={{ fontSize: 13, marginBottom: 6 }}>{placeName || 'Locating...'}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: '#ddd' }}>To destination</div>
          <div style={{ fontWeight: 700 }}>{formatETA(etaToDestination)}</div>
        </div>
        <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>{distanceToDestination ? formatMeters(Math.round(distanceToDestination)) : '—'}</div>

        <div style={{ fontSize: 12, color: '#ddd', marginBottom: 6 }}>Next stops</div>
        <div style={{ maxHeight: 120, overflowY: 'auto' }}>
          {stopEtas.length === 0 ? (
            <div style={{ fontSize: 12, color: '#999' }}>No stops</div>
          ) : (
            stopEtas.map((s) => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13 }}>{s.name}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{formatETA(s.etaSeconds)}</div>
                  <div style={{ fontSize: 11, color: '#bbb' }}>{s.remainingMeters !== null ? formatMeters(s.remainingMeters) : ''}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>Last: {lastSeenStr || '—'}</div>
      </div>
    </div>
  );
};

export default MapboxMap;