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
  const userMarkerRef = useRef(null);

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
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [78.9568, 29.2138],
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

  // Add directions and route when map is loaded and we have start/end locations
  useEffect(() => {
    const hasCoords = (p) => p && typeof p.lng === 'number' && typeof p.lat === 'number';
    if (!mapLoaded || !map.current || !hasCoords(startLocation) || !hasCoords(endLocation)) return;

    const addDirections = async () => {
      try {
        // Remove existing route if any
        if (map.current.getSource('route')) {
          map.current.removeLayer('route');
          map.current.removeSource('route');
        }

        // Skip Mapbox Directions API to avoid 403 errors
        // Add a simple straight line between start and end points
        console.log('Adding straight line route to avoid API errors');
        
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [startLocation.lng, startLocation.lat],
                [endLocation.lng, endLocation.lat]
              ]
            }
          }
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#00e0ff',
            'line-width': 4,
            'line-opacity': 0.8
          }
        });

        // Fit map to show both points
        const bounds = new mapboxgl.LngLatBounds(
          [startLocation.lng, startLocation.lat],
          [endLocation.lng, endLocation.lat]
        );
        map.current.fitBounds(bounds, { padding: 50 });

        console.log('Added straight line route successfully');
      } catch (error) {
        console.error('Error adding route:', error);
      }
    };

    addDirections();
  }, [mapLoaded, startLocation, endLocation]);

  // Update current location marker
  useEffect(() => {
    const hasCoords = (p) => p && typeof p.lng === 'number' && typeof p.lat === 'number';
    if (!mapLoaded || !map.current || !hasCoords(currentLocation)) return;
    // Maintain a single marker instance for current device location
    if (!userMarkerRef.current) {
      userMarkerRef.current = new mapboxgl.Marker({ color: '#00e0ff', scale: 1.2 });
      userMarkerRef.current.addTo(map.current);
    }
    userMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);

    // Center map on current location
    try {
      map.current.setCenter([currentLocation.lng, currentLocation.lat]);
    } catch {}
    map.current.setZoom(13);

  }, [mapLoaded, currentLocation, busNumber]);

  // Geolocate: if app runs on a device, use its GPS and draw route to destination
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    if (!('geolocation' in navigator)) return;
    const hasCoords = (p) => p && typeof p.lng === 'number' && typeof p.lat === 'number';
    if (!hasCoords(endLocation)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Update marker and center softly
        if (!userMarkerRef.current) {
          userMarkerRef.current = new mapboxgl.Marker({ color: '#00e0ff', scale: 1.2 }).addTo(map.current);
        }
        userMarkerRef.current.setLngLat([coords.lng, coords.lat]);
        map.current.easeTo({ center: [coords.lng, coords.lat], duration: 800 });

        // Draw simple line from current device location to destination
        try {
          if (map.current.getSource('device-route')) {
            map.current.removeLayer('device-route');
            map.current.removeSource('device-route');
          }
          map.current.addSource('device-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [ [coords.lng, coords.lat], [endLocation.lng, endLocation.lat] ]
              }
            }
          });
          map.current.addLayer({
            id: 'device-route',
            type: 'line',
            source: 'device-route',
            paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.85 }
          });
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchId && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [mapLoaded, endLocation]);

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
