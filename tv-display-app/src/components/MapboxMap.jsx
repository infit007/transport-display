// MapboxMap.jsx
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";

mapboxgl.accessToken =
  "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

const DEFAULT_ZOOM = 17;

/* -------------------- helpers -------------------- */
const isValid = (loc) =>
  loc &&
  Number.isFinite(loc.lat) &&
  Number.isFinite(loc.lng) &&
  Math.abs(loc.lat) > 0.0001 &&
  Math.abs(loc.lng) > 0.0001;

/* -------------------- component -------------------- */
const MapboxMap = ({ currentLocation, endLocation, follow = true }) => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  const routeLineRef = useRef(null);
  const routeLoadedRef = useRef(false);

  const vehicleMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);

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
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (raf) cancelAnimationFrame(raf);
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

  /* -------------------- load route (SAFE) -------------------- */
  useEffect(() => {
    if (!mapReady) return;
    if (!isValid(currentLocation) || !isValid(endLocation)) return;
    if (routeLoadedRef.current) return;

    const loadRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        console.log("[Map] OSRM response", data);
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        try { console.log("[Map] route coords (raw)", coords); } catch {}
        try { if (Array.isArray(coords)) console.table(coords); } catch {}
        try {
          if (Array.isArray(data?.waypoints)) {
            console.log("[Map] waypoints (raw)", data.waypoints);
            const wp = data.waypoints.map((w) => ({
              name: w?.name,
              lat: w?.location?.[1],
              lng: w?.location?.[0],
              distance: w?.distance,
            }));
            console.table(wp);
          }
        } catch {}
        if (!coords || coords.length < 2) return;

        routeLoadedRef.current = true;
        routeLineRef.current = lineString(coords);

        if (!mapRef.current.getSource("route")) {
          mapRef.current.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: coords },
            },
          });
        }

        // 🛣️ Google Maps style route (casing + main line)
        if (!mapRef.current.getLayer("route-casing")) mapRef.current.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#0a0a0a",
            "line-width": 9,
            "line-opacity": 0.6,
          },
        });

        if (!mapRef.current.getLayer("route-line")) mapRef.current.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#00e0ff",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });

        // 🎯 destination marker
        const destEl = document.createElement("div");
        destEl.style.cssText =
          "width:22px;height:22px;border-radius:50%;background:#00c853;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)";

        console.log("[Map] creating destination marker", endLocation);
        destinationMarkerRef.current = new mapboxgl.Marker({
          element: destEl,
        })
          .setLngLat([endLocation.lng, endLocation.lat])
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

          // After showing the full route, fly into the current position
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
  }, [mapReady, currentLocation, endLocation]);

  /* -------------------- snap to route -------------------- */
  const snapToRoute = (lat, lng) => {
    if (!routeLineRef.current) return [lng, lat];

    const snapped = nearestPointOnLine(
      routeLineRef.current,
      point([lng, lat]),
      { units: "kilometers" }
    );

    return snapped.geometry.coordinates;
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
        "width:18px;height:18px;border-radius:50%;background:#2979ff;border:3px solid white;box-shadow:0 0 0 6px rgba(41,121,255,0.25);";

      vehicleMarkerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat(target)
        .addTo(mapRef.current);
    } else {
      vehicleMarkerRef.current.setLngLat(target);
    }

    // 🎥 Follow camera without horizontal sweep
    if (follow) {
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
