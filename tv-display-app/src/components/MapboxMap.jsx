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
    } catch (e) {
      console.error("[Map] failed to create map", e);
    }

    return () => {
      console.log("[Map] removing map instance");
      try { mapRef.current?.remove(); } catch {}
      mapRef.current = null;
    };
  }, []);

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

    // 🎥 Google Maps–like camera follow
    if (follow) {
      console.log("[Map] easing camera to", target);
      mapRef.current.easeTo({
        center: target,
        zoom: DEFAULT_ZOOM,
        duration: 700,
        easing: (t) => t,
      });
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
