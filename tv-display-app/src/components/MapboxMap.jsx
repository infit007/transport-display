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

  // You'll need to get a free Mapbox access token from https://mapbox.com
  // For now, using a demo token - replace with your own
  const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    // Set the access token
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [78.9568, 29.2138],
      zoom: 12,
      attributionControl: false
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      console.log('Mapbox map loaded successfully');
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
    if (!mapLoaded || !map.current || !startLocation || !endLocation) return;

    const addDirections = async () => {
      try {
        // Remove existing route if any
        if (map.current.getSource('route')) {
          map.current.removeLayer('route');
          map.current.removeSource('route');
        }

        // Get directions from Mapbox Directions API
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`
        );
        
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          
          // Add route to map
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });

          // Add route layer
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

          // Fit map to route bounds
          const coordinates = route.geometry.coordinates;
          const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

          map.current.fitBounds(bounds, {
            padding: 50
          });

          console.log('Directions route added successfully');
        }
      } catch (error) {
        console.error('Error adding directions:', error);
      }
    };

    addDirections();
  }, [mapLoaded, startLocation, endLocation]);

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

    // Center map on current location
    map.current.setCenter([currentLocation.lng, currentLocation.lat]);
    map.current.setZoom(13);

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
