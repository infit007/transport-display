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
  const currentMarkerRef = useRef(null);

  const isValidLngLat = (p) => {
    return p && typeof p.lat === 'number' && typeof p.lng === 'number' && !Number.isNaN(p.lat) && !Number.isNaN(p.lng);
  };

  // You'll need to get a free Mapbox access token from https://mapbox.com
  // For now, using a demo token - replace with your own
  const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    // Set the access token
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    // Initialize map with OpenStreetMap directly to avoid token issues
    const safeCenter = (isValidLngLat(currentLocation) ? [currentLocation.lng, currentLocation.lat] : [78.9568, 29.2138]);
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
      center: safeCenter,
      zoom: 12,
      attributionControl: false
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      console.log('OpenStreetMap loaded successfully');
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
    });

    // Add navigation control
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add realistic road route using OSRM whenever current/end change
  useEffect(() => {
    if (!mapLoaded) return;
    const m = map.current;
    if (!m) return;
    if (!isValidLngLat(endLocation)) return;
    // Prefer currentLocation (device). Fallback to startLocation if valid
    const start = isValidLngLat(currentLocation) ? currentLocation : startLocation;
    if (!isValidLngLat(start)) return;

    const drawRoute = async () => {
      try {
        // Remove existing route if any
        if (m.getSource('route')) {
          if (m.getLayer('route')) m.removeLayer('route');
          m.removeSource('route');
        }

        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();
        const coords = json?.routes?.[0]?.geometry?.coordinates;

        if (!Array.isArray(coords) || coords.length < 2) {
          console.warn('OSRM returned no route, fallback to straight line');
          m.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [[start.lng, start.lat],[endLocation.lng, endLocation.lat]] }
            }
          });
        } else {
          m.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
          });
        }

        m.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#00e0ff', 'line-width': 4, 'line-opacity': 0.85 }
        });

        // Fit bounds to route
        const b = new mapboxgl.LngLatBounds();
        const points = m.getSource('route') && m.getSource('route')._data && m.getSource('route')._data.geometry && m.getSource('route')._data.geometry.coordinates;
        const coordsToUse = Array.isArray(points) && points.length ? points : [[start.lng, start.lat],[endLocation.lng, endLocation.lat]];
        coordsToUse.forEach((p) => { try { b.extend(p); } catch {} });
        m.fitBounds(b, { padding: 50 });
      } catch (e) {
        console.error('Routing error:', e);
      }
    };

    drawRoute();
  }, [mapLoaded, currentLocation, startLocation, endLocation]);

  // Update current location marker
  useEffect(() => {
    if (!mapLoaded) return;
    const m = map.current;
    if (!m || !isValidLngLat(currentLocation)) return;

    // Create/Update current marker without removing others
    if (!currentMarkerRef.current) {
      currentMarkerRef.current = new mapboxgl.Marker({ color: '#00e0ff', scale: 1.2 }).addTo(m);
    }
    currentMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);

    // Center map on current location gently
    m.easeTo({ center: [currentLocation.lng, currentLocation.lat], zoom: 13, duration: 800 });

  }, [mapLoaded, currentLocation, busNumber]);

  // Add start and end markers
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    if (!isValidLngLat(startLocation) || !isValidLngLat(endLocation)) return;

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
