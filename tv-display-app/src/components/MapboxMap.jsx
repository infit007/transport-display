// MapboxMap.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { lineString, point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import length from '@turf/length';

const DEBUG = false; // set true to show debug projection marker + extra console logs

const MAPBOX_ACCESS_TOKEN =
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

/**
 * Haversine distance (meters)
 */
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const computeCumulativeDistances = (coords = []) => {
  const cum = [0];
  for (let i = 1; i < coords.length; i += 1) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const d = haversineMeters(lat1, lng1, lat2, lng2);
    cum.push(cum[i - 1] + d);
  }
  return cum;
};

const formatMeters = (m) => {
  if (!Number.isFinite(m) || m == null) return '—';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
};

const formatETA = (seconds) => {
  if (!Number.isFinite(seconds) || seconds == null || seconds < 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
};

/* === Helpers: WebMercator projection and metric segment projection === */

// lon/lat -> WebMercator meters (EPSG:3857)
const lonLatToMercator = (lon, lat) => {
  const R = 6378137;
  const x = (lon * Math.PI) / 180 * R;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;
  return { x, y };
};

// Project P (lon/lat) onto segment A(lon/lat) -> B(lon/lat) in metric space
const projectPointToSegmentMeters = (lonA, latA, lonB, latB, lonP, latP) => {
  const A = lonLatToMercator(lonA, latA);
  const B = lonLatToMercator(lonB, latB);
  const P = lonLatToMercator(lonP, latP);

  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const wx = P.x - A.x;
  const wy = P.y - A.y;
  const vlen2 = vx * vx + vy * vy;
  if (vlen2 === 0) {
    return {
      t: 0,
      projLon: lonA,
      projLat: latA,
      dist: haversineMeters(latA, lonA, latP, lonP)
    };
  }
  const tRaw = (wx * vx + wy * vy) / vlen2;
  const t = Math.max(0, Math.min(1, tRaw));
  const projX = A.x + vx * t;
  const projY = A.y + vy * t;

  // inverse WebMercator -> lon/lat
  const projLon = (projX / 6378137) * 180 / Math.PI;
  const projLat = (2 * Math.atan(Math.exp(projY / 6378137)) - Math.PI / 2) * 180 / Math.PI;

  const dist = haversineMeters(projLat, projLon, latP, lonP);
  return { t, projLon, projLat, dist };
};

/* === Component === */

const MapboxMap = ({ startLocation, endLocation, currentLocation, stops = [], busNumber, follow = true }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const routeCoordsRef = useRef([]);
  const routeLineRef = useRef(null);
  const cumDistRef = useRef([]);
  const totalRouteMetersRef = useRef(0);

  const stopMarkersRef = useRef([]);
  const vehicleMarkerRef = useRef(null);

  const recentPositionsRef = useRef([]);
  const smoothedSpeedRef = useRef(null);

  const [etaToDestination, setEtaToDestination] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [lastSeenStr, setLastSeenStr] = useState('');
  const [stopEtas, setStopEtas] = useState([]);

  const stopsKey = useMemo(() => JSON.stringify(stops || []), [stops]);

  // Debug marker handle
  const debugProjRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: startLocation ? [startLocation.lng, startLocation.lat] : [78.9629, 20.5937],
      zoom: 12,
      attributionControl: false,
      interactive: true
    });

    mapRef.current.on('load', () => {
      setMapLoaded(true);
      try { mapRef.current.resize(); } catch {}
    });

    return () => {
      try { mapRef.current?.remove(); } catch {}
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Robust projectToRoute: Turf-first, metric per-segment fallback */
  const projectToRoute = (lat, lng) => {
    if (!routeCoordsRef.current || routeCoordsRef.current.length < 2 || !routeLineRef.current) return null;

    // Try Turf first
    try {
      const turfNearest = nearestPointOnLine(routeLineRef.current, point([lng, lat]), { units: 'kilometers' });
      if (turfNearest && turfNearest.geometry) {
        const projLng = turfNearest.geometry.coordinates[0];
        const projLat = turfNearest.geometry.coordinates[1];
        const props = turfNearest.properties || {};

        // possible property name variants
        const distKm = props.distance ?? props.dist ?? props.distancia ?? props.distanceToPoint ?? null;
        const locationRatio = props.location ?? props.loc ?? props.locationRatio ?? null;
        const rawIndex = props.index ?? props.segmentIndex ?? props.idx ?? props.indexOnLine ?? null;

        const distanceToRoute = Number.isFinite(distKm) ? (Number(distKm) * 1000) : null;

        let along = null;
        if (Number.isFinite(rawIndex) && Number.isFinite(locationRatio) && cumDistRef.current && cumDistRef.current.length) {
          const segIndex = Math.max(0, Math.min(cumDistRef.current.length - 2, rawIndex - 1));
          const segLen = (cumDistRef.current[segIndex + 1] ?? 0) - (cumDistRef.current[segIndex] ?? 0);
          along = (cumDistRef.current[segIndex] ?? 0) + (segLen || 0) * Number(locationRatio);
        } else if (Number.isFinite(distanceToRoute)) {
          // cheap approximate: find nearest vertex and use its cum distance as fallback
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < routeCoordsRef.current.length; i++) {
            const [lngI, latI] = routeCoordsRef.current[i];
            const d = haversineMeters(latI, lngI, projLat, projLng);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          along = cumDistRef.current[bestIdx] ?? 0;
        }

        if (Number.isFinite(along) && along > 0) {
          if (DEBUG) console.debug('projectToRoute: turf ok', { projLat, projLng, along, distanceToRoute });
          return { point: [projLng, projLat], alongDistance: along, distanceToRoute: distanceToRoute ?? haversineMeters(lat, lng, projLat, projLng) };
        }
        // otherwise fall through to metric segment projection
      }
    } catch (e) {
      if (DEBUG) console.debug('projectToRoute: turf threw, falling back', e);
    }

    // FALLBACK: metric per-segment projection (accurate)
    let best = { dist: Infinity, segIndex: 0, t: 0, projLon: lng, projLat: lat };
    const coords = routeCoordsRef.current;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lngA, latA] = coords[i];
      const [lngB, latB] = coords[i + 1];
      const proj = projectPointToSegmentMeters(lngA, latA, lngB, latB, lng, lat);
      if (proj.dist < best.dist) {
        best = { dist: proj.dist, segIndex: i, t: proj.t, projLon: proj.projLon, projLat: proj.projLat };
      }
    }

    const segLen = (cumDistRef.current[best.segIndex + 1] ?? 0) - (cumDistRef.current[best.segIndex] ?? 0);
    const along = (cumDistRef.current[best.segIndex] ?? 0) + (segLen || 0) * best.t;

    if (DEBUG) console.debug('projectToRoute: fallback metric', { best, along });

    return { point: [best.projLon, best.projLat], alongDistance: along, distanceToRoute: best.dist };
  };

  // Optional debug marker function
  const showDebugProjection = (projPoint) => {
    if (!DEBUG || !mapRef.current) return;
    try {
      if (debugProjRef.current) {
        debugProjRef.current.remove();
        debugProjRef.current = null;
      }
      const el = document.createElement('div');
      el.style.cssText = 'width:10px;height:10px;background:blue;border-radius:50%;border:2px solid white;';
      debugProjRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(projPoint).addTo(mapRef.current);
    } catch {}
  };

  /* Load route from OSRM whenever start/end (or stops) change */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !startLocation || !endLocation) return;

    let cancelled = false;
    const loadRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`OSRM status ${resp.status}`);
        const data = await resp.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) throw new Error('OSRM returned empty route');

        if (cancelled) return;

        routeCoordsRef.current = coords;
        routeLineRef.current = lineString(coords);
        cumDistRef.current = computeCumulativeDistances(coords);
        totalRouteMetersRef.current = length(routeLineRef.current, { units: 'kilometers' }) * 1000;

        try {
          if (mapRef.current.getSource('route')) {
            mapRef.current.getSource('route').setData({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords }
            });
          } else {
            mapRef.current.addSource('route', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
            });
            mapRef.current.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#00e0ff', 'line-width': 5 }
            });
          }
        } catch (e) {
          console.warn('Unable to update route layer', e);
        }

        // cleanup old stop markers
        stopMarkersRef.current.forEach((entry) => {
          try { entry.marker.remove(); entry.label.remove(); } catch {}
        });
        stopMarkersRef.current = [];

        const effectiveStops =
          stops.length > 0
            ? stops
            : [
                { lat: startLocation.lat, lng: startLocation.lng, name: startLocation.name || 'Start' },
                { lat: endLocation.lat, lng: endLocation.lng, name: endLocation.name || 'End' }
              ];

        const stopEntries = effectiveStops.map((stop) => {
          const projection =
            projectToRoute(stop.lat, stop.lng) || { point: [stop.lng, stop.lat], alongDistance: 0, distanceToRoute: 0 };

          const markerEl = document.createElement('div');
          markerEl.style.cssText =
            'background:#fff;border:2px solid #333;padding:4px 6px;border-radius:6px;font-size:12px;white-space:nowrap;';
          markerEl.innerText = stop.name;
          const marker = new mapboxgl.Marker({ element: markerEl, anchor: 'bottom' }).setLngLat([stop.lng, stop.lat]).addTo(mapRef.current);

          const labelEl = document.createElement('div');
          labelEl.style.cssText =
            'background:rgba(0,0,0,0.7);color:#fff;font-size:11px;padding:4px 6px;border-radius:4px;margin-bottom:6px;';
          labelEl.innerText = 'ETA: —';
          const label = new mapboxgl.Marker({ element: labelEl, anchor: 'bottom' }).setLngLat([stop.lng, stop.lat]).addTo(mapRef.current);

          return {
            marker,
            label,
            info: {
              name: stop.name,
              alongDistance: projection.alongDistance,
              distanceFromRoute: projection.distanceToRoute
            }
          };
        });

        stopMarkersRef.current = stopEntries;
        setStopEtas(stopEntries.map((entry) => ({ name: entry.info.name, remainingMeters: null, etaSeconds: null })));

        try {
          const bounds = coords.reduce((agg, coord) => agg.extend(coord), new mapboxgl.LngLatBounds(coords[0], coords[0]));
          mapRef.current.fitBounds(bounds, { padding: 60 });
        } catch (e) {
          console.warn('Failed to fit bounds', e);
        }
      } catch (error) {
        console.error('Unable to load route', error);
      }
    };

    loadRoute();
    return () => { cancelled = true; };
  }, [mapLoaded, startLocation?.lat, startLocation?.lng, endLocation?.lat, endLocation?.lng, stopsKey]);

  /* speed estimation from recent samples */
  const estimateSpeed = () => {
    const samples = recentPositionsRef.current.slice(-4);
    if (samples.length < 2) return null;
    let totalDistance = 0;
    let totalTime = 0;
    for (let i = 1; i < samples.length; i += 1) {
      const prev = samples[i - 1];
      const cur = samples[i];
      const dt = Math.max(0.001, (cur.ts - prev.ts) / 1000);
      const d = haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng);
      totalDistance += d;
      totalTime += dt;
    }
    if (totalTime <= 0) return null;
    return totalDistance / totalTime;
  };

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !currentLocation || !routeCoordsRef.current.length) return;

    const ts = Number.isFinite(currentLocation.ts) ? currentLocation.ts : Date.now();
    recentPositionsRef.current.push({ lat: currentLocation.lat, lng: currentLocation.lng, ts });
    if (recentPositionsRef.current.length > 10) recentPositionsRef.current.shift();

    // create vehicle marker if missing
    if (!vehicleMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:30px;height:30px;border-radius:50%;background:#ff4d4f;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;';
      el.innerText = busNumber ? String(busNumber) : '';
      vehicleMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([currentLocation.lng, currentLocation.lat]).addTo(mapRef.current);
    }

    // speed smoothing
    let speed = estimateSpeed();
    if (Number.isFinite(speed) && speed > 0) {
      smoothedSpeedRef.current = smoothedSpeedRef.current ? 0.25 * speed + 0.75 * smoothedSpeedRef.current : speed;
    }
    speed = smoothedSpeedRef.current;

    // Ensure we have at least a conservative fallback speed for ETA calculation if you want to display ETAs
    // If you prefer to show "—" when speed unknown, set speed = null here.
    if (!Number.isFinite(speed) || speed <= 0) {
      // conservative bus speed ~6 m/s (~21.6 km/h)
      speed = 6;
    }

    const projection = projectToRoute(currentLocation.lat, currentLocation.lng);
    if (!projection) return;

    const remainingMeters = (totalRouteMetersRef.current || 0) - (projection.alongDistance || 0);
    setDistanceToDestination(Math.max(0, remainingMeters));
    setEtaToDestination(speed && speed > 0 ? remainingMeters / speed : null);

    // update stop labels & list
    const updatedStops = stopMarkersRef.current.map((entry) => {
      const remaining = Math.max(0, (entry.info.alongDistance || 0) - (projection.alongDistance || 0));
      const etaSeconds = speed && speed > 0 ? remaining / speed : null;
      try {
        const label = entry.label.getElement();
        label.innerText =
          etaSeconds == null ? `ETA: — • ${formatMeters(remaining)}` : `ETA ${formatETA(etaSeconds)} • ${formatMeters(remaining)}`;
      } catch {}
      return {
        name: entry.info.name,
        remainingMeters: Math.round(remaining),
        etaSeconds: etaSeconds == null ? null : Math.round(etaSeconds)
      };
    });
    setStopEtas(updatedStops);

    try {
      const date = new Date(ts);
      setLastSeenStr(date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) || '');
    } catch {
      setLastSeenStr('');
    }

    // authoritative vehicle position = projected point on route
    const targetPoint = projection.point || [currentLocation.lng, currentLocation.lat];

    // debug projection marker
    showDebugProjection(targetPoint);

    try {
      if (vehicleMarkerRef.current) {
        // snap vehicle to projected point (no smoothing) to avoid mismatches
        vehicleMarkerRef.current.setLngLat(targetPoint);
      }
    } catch {}

    // always center (follow) by default to show movement
    try {
      mapRef.current.easeTo({ center: targetPoint, duration: 600, offset: [0, -60] });
    } catch {}

    if (DEBUG) {
      console.debug('GPS', currentLocation, 'proj', projection, 'totalRoute', totalRouteMetersRef.current, 'speed(m/s)', speed);
    }
  }, [mapLoaded, currentLocation, follow, busNumber]);

  const liveLocationLabel = currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Locating...';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      <div
        style={{
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
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{busNumber ? `Bus ${busNumber}` : 'Vehicle'}</div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>{liveLocationLabel}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: '#ddd' }}>To destination</div>
          <div style={{ fontWeight: 700 }}>{formatETA(etaToDestination)}</div>
        </div>
        <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>{formatMeters(distanceToDestination)}</div>

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
                  <div style={{ fontSize: 11, color: '#bbb' }}>{s.remainingMeters != null ? formatMeters(s.remainingMeters) : ''}</div>
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

export default MapboxMap;
