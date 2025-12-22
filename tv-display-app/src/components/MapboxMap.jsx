// MapboxMap.jsx
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import length from "@turf/length";

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

const DEFAULT_ZOOM = 17;

/* -------------------- Utils -------------------- */
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* -------------------- Component -------------------- */
const MapboxMap = ({
  currentLocation,   // ✅ used as start
  endLocation,       // ✅ final destination
  follow = true,
}) => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  const routeCoordsRef = useRef([]);
  const routeLineRef = useRef(null);
  const totalRouteMetersRef = useRef(0);

  const vehicleMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);

  const isValid = (loc) =>
    loc &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng) &&
    Math.abs(loc.lat) > 0.0001 &&
    Math.abs(loc.lng) > 0.0001;

  /* -------------------- Create map ONCE -------------------- */
  useEffect(() => {
    if (mapRef.current || !isValid(currentLocation)) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,

      // ✅ OpenStreetMap raster tiles
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },

      center: [currentLocation.lng, currentLocation.lat],
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    mapRef.current.on("load", () => {
      setMapLoaded(true);
      mapRef.current.resize();
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [currentLocation]);

  /* -------------------- Load route (current → destination) -------------------- */
  useEffect(() => {
    if (!mapLoaded) return;
    if (!isValid(currentLocation) || !isValid(endLocation)) return;
    if (routeCoordsRef.current.length > 0) return;

    const loadRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        const coords = data.routes[0].geometry.coordinates;

        routeCoordsRef.current = coords;
        routeLineRef.current = lineString(coords);
        totalRouteMetersRef.current =
          length(routeLineRef.current, { units: "kilometers" }) * 1000;

        mapRef.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
          },
        });

        mapRef.current.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#00e0ff",
            "line-width": 5,
          },
        });

        // 🎯 Destination marker
        const destEl = document.createElement("div");
        destEl.style.cssText =
          "width:22px;height:22px;border-radius:50%;background:#00c853;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);";

        destinationMarkerRef.current = new mapboxgl.Marker({
          element: destEl,
          anchor: "center",
        })
          .setLngLat([endLocation.lng, endLocation.lat])
          .addTo(mapRef.current);
      } catch (e) {
        console.error("Route load failed", e);
      }
    };

    loadRoute();
  }, [mapLoaded, currentLocation, endLocation]);

  /* -------------------- Snap GPS to route -------------------- */
  const projectToRoute = (lat, lng) => {
    if (!routeLineRef.current) return null;

    const snapped = nearestPointOnLine(
      routeLineRef.current,
      point([lng, lat]),
      { units: "kilometers" }
    );

    return {
      point: snapped.geometry.coordinates,
      distanceToRoute: (snapped.properties.distance ?? 0) * 1000,
    };
  };

  /* -------------------- Live GPS updates -------------------- */
  useEffect(() => {
    if (!mapLoaded || !isValid(currentLocation)) return;

    let target = [currentLocation.lng, currentLocation.lat];

    if (routeLineRef.current) {
      const projection = projectToRoute(
        currentLocation.lat,
        currentLocation.lng
      );

      // Optional reroute if badly off-road
      if (projection?.distanceToRoute > 150) {
        routeCoordsRef.current = [];
      }

      if (projection) target = projection.point;
    }

    // 🚍 Vehicle marker
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

    // 🎥 Smooth follow
    if (follow) {
      mapRef.current.easeTo({
        center: target,
        zoom: DEFAULT_ZOOM,
        duration: 700,
        easing: (t) => t,
      });
    }
  }, [currentLocation, follow, mapLoaded]);

  /* -------------------- Render -------------------- */
  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
      }}
    />
  );
};

export default MapboxMap;
