import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MapboxMap = ({ 
  startLocation, 
  endLocation, 
  currentLocation, 
  journeyProgress = 0,
  busNumber 
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const routeCoordsRef = useRef([]);
  const didFitRef = useRef(false);

  // You'll need to get a free Mapbox access token from https://mapbox.com
  // For now, using a demo token - replace with your own
  const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    // Set the access token
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    // Initialize map with OpenStreetMap directly to avoid token issues
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
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }
        ]
      },
      // Start neutral; we'll center once we have realtime or route
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [0, 0],
      zoom: 12,
      attributionControl: false,
      interactive: false // touchless navigation
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      console.log('OpenStreetMap loaded successfully');
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
    });

    // Remove navigation controls (zoom/rotation) as not needed on TV display

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add directions and route when map is loaded and we have start/end locations
  useEffect(() => {
    if (!mapLoaded || !map.current || !startLocation || !endLocation) return;

    const addDirections = async () => {
      try {
        // Remove existing route if any
        if (map.current.getSource('route')) {
          map.current.removeLayer('route');
          map.current.removeSource('route');
        }
        // Try OSRM public routing API for real road directions
        // Docs: https://project-osrm.org/docs/v5.24.0/api/#route-service
        const url = `https://router.project-osrm.org/route/v1/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
        let coords = null;
        try {
          const resp = await fetch(url, { method: 'GET' });
          if (resp.ok) {
            const json = await resp.json();
            coords = json?.routes?.[0]?.geometry?.coordinates || null;
          }
        } catch (_) {
          // ignore network errors; will fall back below
        }

        if (!coords || !Array.isArray(coords) || coords.length < 2) {
          // Fallback to simple straight line when routing unavailable
          coords = [
            [startLocation.lng, startLocation.lat],
            [endLocation.lng, endLocation.lat]
          ];
          console.log('OSRM unavailable, using straight line fallback');
        } else {
          console.log('OSRM route loaded with', coords.length, 'points');
        }

        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords }
          }
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#00e0ff',
            'line-width': 6,
            'line-opacity': 0.95
          }
        });

        // Fit bounds to route just once
        const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
        if (!didFitRef.current) {
          map.current.fitBounds(bounds, { padding: 60 });
          didFitRef.current = true;
        }

        // Save for touchless navigation along the path
        routeCoordsRef.current = coords;
      } catch (error) {
        console.error('Error adding route:', error);
      }
    };

    addDirections();
  }, [mapLoaded, startLocation, endLocation]);

  // Touchless navigation: follow the route based on journey progress
  useEffect(() => {
    try {
      if (!mapLoaded || !map.current) return;
      const coords = routeCoordsRef.current;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const progress = Math.max(0, Math.min(1, journeyProgress || 0));
      const idxFloat = progress * (coords.length - 1);
      const idx = Math.max(0, Math.min(coords.length - 1, Math.floor(idxFloat)));
      const center = coords[idx];
      const next = coords[Math.min(coords.length - 1, idx + 1)];
      const bearing = (() => {
        try {
          const [lng1, lat1] = center; const [lng2, lat2] = next;
          const toRad = (d) => d * Math.PI / 180;
          const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
          const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
          const ang = Math.atan2(y, x) * 180 / Math.PI;
          return (ang + 360) % 360;
        } catch { return 0; }
      })();

      const zoom = progress < 0.1 || progress > 0.9 ? 11.5 : 13.5; // overview at ends, closer mid-route
      map.current.easeTo({
        center,
        zoom,
        bearing,
        pitch: 45,
        duration: 800,
        easing: (t) => t
      });
    } catch {}
  }, [mapLoaded, journeyProgress]);

  // Update current location marker
  useEffect(() => {
    if (!mapLoaded || !map.current || !currentLocation) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add current location marker
    const marker = new mapboxgl.Marker({
      color: '#00e0ff',
      scale: 1.2
    })
      .setLngLat([currentLocation.lng, currentLocation.lat])
      .addTo(map.current);

    // Add popup with bus info
    const popup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(`
        <div style="color: #000; font-size: 12px;">
          <strong>Bus ${busNumber}</strong><br/>
          ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}
        </div>
      `);
    
    marker.setPopup(popup);

    // Center map smoothly on current location without changing zoom
    try {
      const current = [currentLocation.lng, currentLocation.lat];
      map.current.easeTo({ center: current, duration: 600 });
    } catch {}

  }, [mapLoaded, currentLocation, busNumber]);

  // Add start and end markers
  useEffect(() => {
    if (!mapLoaded || !map.current || !startLocation || !endLocation) return;

    // Remove existing start/end markers
    const existingMarkers = document.querySelectorAll('.start-marker, .end-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add start marker
    const startMarker = new mapboxgl.Marker({
      color: '#4CAF50',
      className: 'start-marker'
    })
      .setLngLat([startLocation.lng, startLocation.lat])
      .addTo(map.current);

    const startPopup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(`
        <div style="color: #000; font-size: 12px;">
          <strong>Start: ${startLocation.name || 'Origin'}</strong>
        </div>
      `);
    startMarker.setPopup(startPopup);

    // Add end marker
    const endMarker = new mapboxgl.Marker({
      color: '#F44336',
      className: 'end-marker'
    })
      .setLngLat([endLocation.lng, endLocation.lat])
      .addTo(map.current);

    const endPopup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(`
        <div style="color: #000; font-size: 12px;">
          <strong>End: ${endLocation.name || 'Destination'}</strong>
        </div>
      `);
    endMarker.setPopup(endPopup);

  }, [mapLoaded, startLocation, endLocation]);

  return (
    <div className="mapbox-container">
      <div ref={mapContainer} className="mapbox-map" />
      <div className="mapbox-attribution">
        © <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>
      </div>
    </div>
  );
};

export default MapboxMap;
