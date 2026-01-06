// Compute bearing from (lat1,lng1) to (lat2,lng2) in degrees [0,360)
const bearingDeg = (lat1, lng1, lat2, lng2) => {
  try {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lng2 - lng1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    let θ = toDeg(Math.atan2(y, x));
    if (!Number.isFinite(θ)) return 0;
    return (θ + 360) % 360;
  } catch {
    return 0;
  }
};

// Validate helpers for coordinates
const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isLngLatPair = (c) => Array.isArray(c) && c.length >= 2 && isFiniteNum(Number(c[0])) && isFiniteNum(Number(c[1]));
const cleanCoords = (coords) => {
  try {
    if (!Array.isArray(coords)) return [];
    const out = [];
    for (const c of coords) {
      if (isLngLatPair(c)) {
        out.push([Number(c[0]), Number(c[1])]);
      }
    }
    return out;
  } catch { return []; }
};
// MapboxMap.jsx
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { BACKEND_URL } from "../config/backend-simple.js";

// Prefer token from environment (injected by Webpack DefinePlugin)
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || "";
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const DEFAULT_ZOOM = 17;

/* -------------------- helpers -------------------- */
const isValid = (loc) =>
  loc &&
  Number.isFinite(loc.lat) &&
  Number.isFinite(loc.lng) &&
  Math.abs(loc.lat) > 0.0001 &&
  Math.abs(loc.lng) > 0.0001;

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/* -------------------- component -------------------- */
const MapboxMap = ({ currentLocation, startLocation, endLocation, follow = true, busNumber, onNextStop, onFinalDestinationChange }) => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const suppressFollowUntilRef = useRef(0);

  const routeLineRef = useRef(null);
  const routeLoadedRef = useRef(false);
  const lastRouteUpdateRef = useRef(0);

  const vehicleMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const prevPosRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const midpointsRef = useRef([]); // ordered active midpoints for this bus
  const orientedRef = useRef([]);   // midpoints oriented for current trip direction
  const directionRef = useRef(null); // null=undecided, true=reverse, false=forward
  const progressIdxRef = useRef(0);  // monotonically increasing index of passed midpoints
  const reverseRef = useRef(false);   // false: start->end, true: end->start
  const routeStartedRef = useRef(false); // becomes true once bus leaves its starting terminal

  // Load midpoints for routing when busNumber changes
  useEffect(() => {
    (async () => {
      try {
        if (!busNumber) { midpointsRef.current = []; return; }
        const url = `${BACKEND_URL}/api/midpoints/public/${encodeURIComponent(busNumber)}`;
        const r = await fetch(url, { credentials: 'omit' });
        const j = await r.json();
        if (j && j.ok && Array.isArray(j.items)) {
          midpointsRef.current = j.items
            .map((m) => ({ lat: Number(m.lat), lng: Number(m.lng), name: m.name || '', radius: Number(m.radius_m) || 150 }))
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
          orientedRef.current = reverseRef.current ? [...midpointsRef.current].reverse() : [...midpointsRef.current];
          directionRef.current = Boolean(reverseRef.current);
          progressIdxRef.current = 0;
        } else {
          midpointsRef.current = [];
          orientedRef.current = [];
          directionRef.current = Boolean(reverseRef.current);
          progressIdxRef.current = 0;
        }
      } catch { midpointsRef.current = []; }
    })();
  }, [busNumber]);

  // Decide midpoint travel order based on current and destination
  const getOrientedMidpoints = (cur, dest) => {
    const mps = midpointsRef.current || [];
    if (!mps.length || !isValid(cur) || !isValid(dest)) return [];
    if (mps.length === 1) return mps;
    const first = mps[0];
    const last = mps[mps.length - 1];
    const dCurFirst = haversineMeters(cur.lat, cur.lng, first.lat, first.lng);
    const dCurLast = haversineMeters(cur.lat, cur.lng, last.lat, last.lng);
    const dDestFirst = haversineMeters(dest.lat, dest.lng, first.lat, first.lng);
    const dDestLast = haversineMeters(dest.lat, dest.lng, last.lat, last.lng);
    // If current is nearer to 'last' and destination nearer to 'first', reverse
    if (directionRef.current === null) {
      directionRef.current = (dCurLast < dCurFirst) && (dDestFirst < dDestLast);
    }
    const oriented = directionRef.current ? [...mps].reverse() : [...mps];
    orientedRef.current = oriented;
    return oriented;
  };

  // Return upcoming midpoints, permanently locking passed ones by order
  const getUpcomingMidpoints = (cur, dest) => {
    const oriented = getOrientedMidpoints(cur, dest);
    if (!oriented.length) return [];
    if (!routeLineRef.current) return oriented;

    let furthestPassed = progressIdxRef.current || 0;
    for (let i = furthestPassed; i < oriented.length; i += 1) {
      const p = oriented[i];
      const d = haversineMeters(cur.lat, cur.lng, p.lat, p.lng);
      // Once inside radius even once, lock as passed forever
      if (d < (Number(p.radius) || 150)) {
        furthestPassed = i + 1;
      } else {
        break;
      }
    }
    progressIdxRef.current = furthestPassed;
    return oriented.slice(furthestPassed);
  };

  /* -------------------- create map ONCE -------------------- */
  useEffect(() => {
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;
    console.log("[Map] creating map instance");

    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        center: isValid(currentLocation)
          ? [currentLocation.lng, currentLocation.lat]
          : [0, 0],
        zoom: isValid(currentLocation) ? DEFAULT_ZOOM : 2,
        attributionControl: false,
        style: {
          version: 8,
          // Provide glyphs for symbol text rendering (required when using text-field)
          // Public demo glyphs work with mapbox-gl and maplibre
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });

      mapRef.current.on("load", () => {
        console.log("[Map] load event");
      });
      mapRef.current.on("idle", () => {
        console.log("[Map] idle -> ready");
        setMapReady(true);
        try { mapRef.current.resize(); } catch {}
      });
      const suppress = () => { suppressFollowUntilRef.current = Date.now() + 15000; };
      mapRef.current.on('dragstart', suppress);
      mapRef.current.on('zoomstart', suppress);
      mapRef.current.on('rotatestart', suppress);
      mapRef.current.on('pitchstart', suppress);
      mapRef.current.on('touchstart', suppress);
      mapRef.current.on('wheel', suppress);
      mapRef.current.on("moveend", () => {
        try {
          const center = mapRef.current.getCenter();
          const zoom = mapRef.current.getZoom();
          console.log("[Map] moveend center/zoom:", { center, zoom });
        } catch {}
      });
      mapRef.current.on("error", (e) => {
        console.error("[Map] error event", e?.error || e);
      });

      // Some mobile browsers can lose WebGL context when tabbing or backgrounding
      mapRef.current.on("webglcontextlost", (e) => {
        try { e?.preventDefault?.(); } catch {}
        console.warn("[Map] webglcontextlost: preventing default to allow restore");
      });
    } catch (e) {
      console.error("[Map] failed to create map", e);
    }

    return () => {
      console.log("[Map] removing map instance");
      try { mapRef.current?.remove(); } catch {}
      mapRef.current = null;
    };
  }, []);

  // Resize on viewport/orientation changes (mobile URL bar show/hide, rotation)
  useEffect(() => {
    if (!mapRef.current) return;
    let raf = null, last = 0;
    const onResize = () => {
      const now = Date.now();
      if (now - last < 50) {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(onResize);
        return;
      }
      last = now;
      try {
        mapRef.current.resize();
        const c = mapRef.current.getContainer();
        console.log("[Map] window resize -> map.resize()", { w: c?.clientWidth, h: c?.clientHeight });
      } catch {}
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    let ro;
    try {
      ro = new ResizeObserver(() => onResize());
      if (mapContainerRef.current) ro.observe(mapContainerRef.current);
    } catch {}
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (raf) cancelAnimationFrame(raf);
      try { ro && ro.disconnect(); } catch {}
    };
  }, [mapReady]);

  // If map was created before we had a location, set initial camera when a valid location appears
  useEffect(() => {
    if (!mapReady) return;
    if (!isValid(currentLocation)) return;
    if (!mapRef.current) return;
    console.log("[Map] initial center/jump to current location", currentLocation);
    try {
      mapRef.current.jumpTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: DEFAULT_ZOOM,
      });
    } catch (e) {
      console.warn("[Map] jumpTo failed", e);
    }
  }, [mapReady, currentLocation]);

  async function buildRoute(forwardStart, forwardEnd, mps) {
    try {
      const coordsList = [
        `${forwardStart.lng},${forwardStart.lat}`,
        ...mps.map((p) => `${p.lng},${p.lat}`),
        `${forwardEnd.lng},${forwardEnd.lat}`,
      ];
      const waypoints = coordsList.join(";");
      const radiuses = new Array(coordsList.length).fill(150).join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=false&annotations=false&continue_straight=true&radiuses=${radiuses}`;
      const res = await fetch(url);
      const data = await res.json();
      const coords = cleanCoords(data?.routes?.[0]?.geometry?.coordinates);
      if (!coords || coords.length < 2) return false;

      routeLoadedRef.current = true;
      routeLineRef.current = lineString(coords);

      if (!mapRef.current.getSource("route")) {
        mapRef.current.addSource("route", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } },
        });
      } else {
        mapRef.current.getSource("route").setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
        });
      }

      // Casing + main line layers (create if missing)
      if (!mapRef.current.getLayer("route-casing")) mapRef.current.addLayer({ id: "route-casing", type: "line", source: "route", paint: { "line-color": "#0a0a0a", "line-width": 9, "line-opacity": 0.6 } });
      if (!mapRef.current.getLayer("route-line")) mapRef.current.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#00e0ff", "line-width": 5, "line-opacity": 0.95 } });
      return true;
    } catch { return false; }
  }

  /* -------------------- load route (initial) -------------------- */
  useEffect(() => {
    if (!mapReady) return;
    if (!isValid(startLocation) || !isValid(endLocation)) return;
    if (routeLoadedRef.current) return;

    const loadRoute = async () => {
      try {
        // Use configured route: start -> midpoints (ordered) -> end
        const mpsBase = midpointsRef.current || [];
        let fStart = startLocation;
        let fEnd = endLocation;
        let mpsOriented = [...mpsBase];

        const nearMeters = 200;
        if (isValid(currentLocation)) {
          const dToStart = isValid(startLocation) ? haversineMeters(currentLocation.lat, currentLocation.lng, startLocation.lat, startLocation.lng) : Infinity;
          const dToEnd = isValid(endLocation) ? haversineMeters(currentLocation.lat, currentLocation.lng, endLocation.lat, endLocation.lng) : Infinity;
          if (dToEnd <= nearMeters && dToEnd < dToStart) {
            reverseRef.current = true;
            directionRef.current = true;
            mpsOriented = [...mpsBase].reverse();
            fStart = endLocation;
            fEnd = startLocation;
          } else {
            reverseRef.current = false;
            directionRef.current = false;
            mpsOriented = [...mpsBase];
            fStart = startLocation;
            fEnd = endLocation;
          }
        } else {
          reverseRef.current = false;
          directionRef.current = false;
          mpsOriented = [...mpsBase];
        }

        orientedRef.current = mpsOriented;
        progressIdxRef.current = 0;
        console.debug('[Map] ordered midpoints for routing', orientedRef.current);
        const ok = await buildRoute(fStart, fEnd, orientedRef.current);
        if (!ok) return;
        try { console.log("[Map] route ready"); } catch {}
        try {
          if (typeof onFinalDestinationChange === 'function') {
            const destName = reverseRef.current ? (startLocation?.name || '') : (endLocation?.name || '');
            onFinalDestinationChange(destName);
          }
          if (Array.isArray(orientedRef.current) && orientedRef.current.length && typeof onNextStop === 'function') {
            onNextStop(orientedRef.current[0]?.name || '');
          }
        } catch {}

        if (!mapRef.current.getSource("route")) {
          mapRef.current.addSource("route", {
            type: "geojson",
            data: routeLineRef.current,
          });
        } else {
          mapRef.current.getSource("route").setData(routeLineRef.current);
        }

        // 🛣️ ensure layers exist (buildRoute already ensured too)
        if (!mapRef.current.getLayer("route-casing")) mapRef.current.addLayer({ id: "route-casing", type: "line", source: "route", paint: { "line-color": "#0a0a0a", "line-width": 9, "line-opacity": 0.6 } });
        if (!mapRef.current.getLayer("route-line")) mapRef.current.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#00e0ff", "line-width": 5, "line-opacity": 0.95 } });

        // 📍 Midpoint markers (circles + labels)
        try {
          const mpFeatures = (orientedRef.current || []).map((p, i) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: { name: p.name || `Stop ${i+1}`, index: i }
          }));
          if (!mapRef.current.getSource('midpoints')) {
            mapRef.current.addSource('midpoints', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: mpFeatures },
            });
          } else {
            mapRef.current.getSource('midpoints').setData({ type: 'FeatureCollection', features: mpFeatures });
          }
          if (!mapRef.current.getLayer('midpoints-circles')) {
            mapRef.current.addLayer({
              id: 'midpoints-circles',
              type: 'circle',
              source: 'midpoints',
              paint: {
                'circle-radius': 6,
                'circle-color': '#e53935',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              },
            });
          }
          if (!mapRef.current.getLayer('midpoints-labels')) {
            mapRef.current.addLayer({
              id: 'midpoints-labels',
              type: 'symbol',
              source: 'midpoints',
              layout: {
                'text-field': ['get', 'name'],
                'text-size': 12,
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-font': ['Open Sans Regular','Arial Unicode MS Regular'],
              },
              paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 1.2 },
            });
          }
        } catch {}

        // 🟢 start marker (origin)
        if (isValid(startLocation)) {
          const startEl = document.createElement("div");
          startEl.style.cssText =
            "width:22px;height:22px;border-radius:50%;background:#7b1fa2;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)";
          if (!startMarkerRef.current) {
            startMarkerRef.current = new mapboxgl.Marker({ element: startEl })
              .setLngLat([startLocation.lng, startLocation.lat])
              .addTo(mapRef.current);
          } else {
            startMarkerRef.current.setLngLat([startLocation.lng, startLocation.lat]);
          }
        }

        // 🎯 destination marker
        const destEl = document.createElement("div");
        destEl.style.cssText =
          "width:22px;height:22px;border-radius:50%;background:#00c853;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)";

        console.log("[Map] creating destination marker", fEnd);
        destinationMarkerRef.current = new mapboxgl.Marker({
          element: destEl,
        })
          .setLngLat([fEnd.lng, fEnd.lat])
          .addTo(mapRef.current);

        // 🎥 Camera: outside -> inside
        try {
          // Compute route bounds
          let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
          for (const [lng, lat] of coords) {
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
          }
          const bounds = [[minLng, minLat], [maxLng, maxLat]];
          console.log("[Map] fitBounds to route", bounds);
          mapRef.current.fitBounds(bounds, {
            padding: { top: 60, right: 60, bottom: 60, left: 60 },
            duration: 700,
            linear: true,
            essential: true,
          });

          // After showing the full route, fly into the current position (if available)
          setTimeout(() => {
            try {
              if (!isValid(currentLocation)) return;
              const target = [currentLocation.lng, currentLocation.lat];
              console.log("[Map] flyTo current after fitBounds", target);
              mapRef.current.flyTo({
                center: target,
                zoom: DEFAULT_ZOOM,
                speed: 0.8, // slower for smoother in-zoom
                curve: 1.6,
                essential: true,
              });
            } catch {}
          }, 750);
        } catch {}
      } catch (e) {
        console.error("[Map] Route load failed", e);
      }
    };

    loadRoute();
  }, [mapReady, startLocation, endLocation]);

  /* -------------------- reroute ALWAYS from current -------------------- */
  const rerouteFromCurrent = async (cur, dest) => {
    try {
      if (!isValid(cur) || !isValid(dest) || !mapRef.current) return;
      const now = Date.now();
      // Throttle network calls to ~0.7s for tighter alignment
      if (now - lastRouteUpdateRef.current < 700) return;
      lastRouteUpdateRef.current = now;

      const mps = getUpcomingMidpoints(cur, dest);
      const coordsList = [
        `${cur.lng},${cur.lat}`,
        ...mps.map((p) => `${p.lng},${p.lat}`),
        `${dest.lng},${dest.lat}`,
      ];
      const waypoints = coordsList.join(";");
      const radiuses = new Array(coordsList.length).fill(150).join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=false&annotations=false&continue_straight=true&radiuses=${radiuses}`;
      const res = await fetch(url);
      const data = await res.json();
      const coords = cleanCoords(data?.routes?.[0]?.geometry?.coordinates);
      if (!Array.isArray(coords) || coords.length < 2) return;

      // Force the route to begin exactly at the current marker
      const forced = cleanCoords([[cur.lng, cur.lat], ...coords.slice(1)]);
      if (forced.length < 2) return;
      routeLineRef.current = lineString(forced);

      if (!mapRef.current.getSource("route")) {
        mapRef.current.addSource("route", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: forced } },
        });
      } else {
        mapRef.current.getSource("route").setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: forced },
        });
      }

      // Update midpoint features if direction changed
      try {
        const mpFeatures = (orientedRef.current || []).map((p, i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { name: p.name || `Stop ${i+1}`, index: i }
        }));
        if (mapRef.current.getSource('midpoints')) {
          mapRef.current.getSource('midpoints').setData({ type: 'FeatureCollection', features: mpFeatures });
        }
      } catch {}
    } catch (e) {
      console.warn("[Map] rerouteFromCurrent failed", e);
    }
  };

  /* -------------------- snap to route -------------------- */
  const snapToRoute = (lat, lng) => {
    const lngNum = Number(lng);
    const latNum = Number(lat);
    if (!isFiniteNum(lngNum) || !isFiniteNum(latNum)) return [lng, lat];
    if (!routeLineRef.current || !isLngLatPair((routeLineRef.current?.geometry?.coordinates||[])[0])) {
      return [lngNum, latNum];
    }
    try {
      const snapped = nearestPointOnLine(
        routeLineRef.current,
        point([lngNum, latNum]),
        { units: "kilometers" }
      );
      const c = snapped?.geometry?.coordinates;
      return isLngLatPair(c) ? [Number(c[0]), Number(c[1])] : [lngNum, latNum];
    } catch {
      return [lngNum, latNum];
    }
  };

  /* -------------------- live GPS updates -------------------- */
  useEffect(() => {
    if (!mapReady || !isValid(currentLocation)) return;

    let target = [currentLocation.lng, currentLocation.lat];

    if (routeLineRef.current) {
      target = snapToRoute(currentLocation.lat, currentLocation.lng);
    }

    // 🚍 ALWAYS show current location marker
    if (!vehicleMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#2979ff;border:3px solid white;box-shadow:0 0 0 6px rgba(41,121,255,0.25);display:flex;align-items:center;justify-content:center;transform-origin:center;";
      // Add a pointer arrow so rotation is visible
      const arrow = document.createElement("div");
      arrow.style.cssText =
        "width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid #fff;position:absolute;top:-6px;left:50%;transform:translateX(-50%);filter:drop-shadow(0 1px 1px rgba(0,0,0,0.4));";
      el.appendChild(arrow);

      vehicleMarkerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat(target)
        .addTo(mapRef.current);
    } else {
      vehicleMarkerRef.current.setLngLat(target);
    }

    // Heading rotation based on movement
    try {
      const last = prevPosRef.current;
      if (last && isValid(last)) {
        const hdg = bearingDeg(last.lat, last.lng, currentLocation.lat, currentLocation.lng);
        const el = vehicleMarkerRef.current.getElement?.() || null;
        if (el) el.style.transform = `rotate(${hdg}deg)`;
      }
      prevPosRef.current = { ...currentLocation };
    } catch {}

    // Keep the configured route intact; no rerouting from current position

    // Trip start detection: mark started once we leave our starting terminal
    try {
      const departMeters = 250;
      if (!routeStartedRef.current) {
        if (reverseRef.current && isValid(endLocation)) {
          const d = haversineMeters(currentLocation.lat, currentLocation.lng, endLocation.lat, endLocation.lng);
          if (d > departMeters) {
            routeStartedRef.current = true;
            try { console.log('[Map] Trip started (reverse leg)'); } catch {}
          }
        } else if (!reverseRef.current && isValid(startLocation)) {
          const d = haversineMeters(currentLocation.lat, currentLocation.lng, startLocation.lat, startLocation.lng);
          if (d > departMeters) {
            routeStartedRef.current = true;
            try { console.log('[Map] Trip started (forward leg)'); } catch {}
          }
        }
      }
    } catch {}

    // Auto-turnaround: if near terminal, reverse route configuration (only after trip has actually started)
    try {
      const nearMeters = 200; // threshold widened for reliable flip near terminals
      if (routeStartedRef.current && !reverseRef.current && isValid(endLocation)) {
        const d = haversineMeters(currentLocation.lat, currentLocation.lng, endLocation.lat, endLocation.lng);
        if (d <= nearMeters) {
          reverseRef.current = true;
          // reverse midpoints and rebuild from end->start
          const mps = [...(midpointsRef.current || [])].reverse();
          orientedRef.current = mps;
          directionRef.current = true;
          progressIdxRef.current = 0;
          buildRoute(endLocation, startLocation, mps).then((ok) => {
            if (ok) {
              if (typeof onFinalDestinationChange === 'function') onFinalDestinationChange(startLocation?.name || '');
              if (Array.isArray(orientedRef.current) && orientedRef.current.length && typeof onNextStop === 'function') {
                onNextStop(orientedRef.current[0]?.name || '');
              }
            }
          });
          routeStartedRef.current = false; // reset for the new leg
        }
      } else if (routeStartedRef.current && reverseRef.current && isValid(startLocation)) {
        const d = haversineMeters(currentLocation.lat, currentLocation.lng, startLocation.lat, startLocation.lng);
        if (d <= nearMeters) {
          reverseRef.current = false;
          const mps = [...(midpointsRef.current || [])];
          orientedRef.current = mps;
          directionRef.current = false;
          progressIdxRef.current = 0;
          buildRoute(startLocation, endLocation, mps).then((ok) => {
            if (ok) {
              if (typeof onFinalDestinationChange === 'function') onFinalDestinationChange(endLocation?.name || '');
              if (Array.isArray(orientedRef.current) && orientedRef.current.length && typeof onNextStop === 'function') {
                onNextStop(orientedRef.current[0]?.name || '');
              }
            }
          });
          routeStartedRef.current = false; // reset for the new leg
        }
      }
    } catch {}

    // 🎥 Follow camera without horizontal sweep
    if (follow && Date.now() >= (suppressFollowUntilRef.current || 0)) {
      try {
        const curCenter = mapRef.current.getCenter();
        const dx = Math.abs(curCenter.lng - target[0]);
        const dy = Math.abs(curCenter.lat - target[1]);
        const dist = Math.max(dx, dy);
        if (dist < 0.0005) {
          // very small movement: jump to avoid visible sweep
          mapRef.current.jumpTo({ center: target });
        } else {
          mapRef.current.flyTo({
            center: target,
            zoom: DEFAULT_ZOOM,
            speed: 1.0,
            curve: 1.4,
            duration: 600,
            essential: true,
          });
        }
      } catch {
        mapRef.current.easeTo({ center: target, zoom: DEFAULT_ZOOM, duration: 500 });
      }
    }

    // 🔔 Determine and report next upcoming midpoint name
    try {
      const hasMidpoints = Array.isArray(midpointsRef.current) && midpointsRef.current.length > 0;
      if (!hasMidpoints) {
        // Midpoints not loaded yet; avoid emitting a misleading terminal as next stop
      } else if (!routeStartedRef.current) {
        // Before departure, prefer the first midpoint from the intended direction
        const oriented = reverseRef.current ? [...midpointsRef.current].reverse() : [...midpointsRef.current];
        const first = oriented[0];
        if (onNextStop) onNextStop(first?.name || '');
      } else {
        const destForDir = reverseRef.current ? (startLocation || currentLocation) : (endLocation || currentLocation);
        const upcoming = getUpcomingMidpoints(currentLocation, destForDir);
        if (Array.isArray(upcoming) && upcoming.length) {
          const next = upcoming[0];
          if (onNextStop) onNextStop(next?.name || '');
        } else if (onNextStop) {
          // When no midpoints remain, show the terminal appropriate to the current direction
          const terminalName = reverseRef.current ? (startLocation?.name || '') : (endLocation?.name || '');
          onNextStop(terminalName);
        }
      }
    } catch {}
  }, [currentLocation, follow, mapReady]);

  /* -------------------- render -------------------- */
  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    />
  );
};

export default MapboxMap;
