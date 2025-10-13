import React, { useEffect, useRef, useState } from 'react';
import { tvDisplayAPI } from '../services/api';
import MapboxMap from './MapboxMap';

const Display = ({ busNumber, depot }) => {
  const selectedBusNumber = busNumber || localStorage.getItem('tv_bus_number') || '';
  const selectedDepot = depot || localStorage.getItem('tv_depot') || '';
  
  // State for bus data from Supabase
  const [busData, setBusData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [nextStop, setNextStop] = useState('');
  const [finalDestination, setFinalDestination] = useState('');
  const [ticker, setTicker] = useState('Welcome to FleetSignage TV Display');
  const [mediaContent, setMediaContent] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const imageTimerRef = useRef(null);
  const [journeyProgress, setJourneyProgress] = useState(0); // 0 to 1
  
  const timerRef = useRef(null);
  const journeyRef = useRef(null);

  // GPS Journey Simulation
  const startJourneySimulation = (startPoint, endPoint) => {
    if (!startPoint || !endPoint) return;
    
    console.log('Starting journey simulation from', startPoint, 'to', endPoint);
    
    // Clear any existing journey
    if (journeyRef.current) {
      clearInterval(journeyRef.current);
    }
    
    // Define route coordinates (simplified linear interpolation)
    const routeCoordinates = [
      { lat: 29.2138, lng: 78.9568, name: startPoint }, // Start
      { lat: 29.2500, lng: 79.0000, name: 'Mid Point 1' },
      { lat: 29.3000, lng: 79.0500, name: 'Mid Point 2' },
      { lat: 29.3500, lng: 79.1000, name: 'Mid Point 3' },
      { lat: 29.4000, lng: 79.1500, name: endPoint } // End
    ];
    
    let currentIndex = 0;
    let progress = 0;
    
    journeyRef.current = setInterval(() => {
      if (currentIndex >= routeCoordinates.length - 1) {
        // Journey complete, restart
        currentIndex = 0;
        progress = 0;
        setJourneyProgress(0);
      }
      
      const currentCoord = routeCoordinates[currentIndex];
      const nextCoord = routeCoordinates[currentIndex + 1];
      
      // Interpolate between current and next coordinates
      const interpolatedLat = currentCoord.lat + (nextCoord.lat - currentCoord.lat) * progress;
      const interpolatedLng = currentCoord.lng + (nextCoord.lng - currentCoord.lng) * progress;
      
      setCurrentLocation({ lat: interpolatedLat, lng: interpolatedLng });
      
      // Update next stop based on progress
      if (progress < 0.5) {
        setNextStop(nextCoord.name);
      } else if (currentIndex < routeCoordinates.length - 2) {
        setNextStop(routeCoordinates[currentIndex + 2].name);
      } else {
        setNextStop(endPoint);
      }
      
      progress += 0.02; // Move 2% per update
      setJourneyProgress(progress);
      
      if (progress >= 1) {
        currentIndex++;
        progress = 0;
      }
    }, 1000); // Update every second
  };

  // Load bus data from backend API
  const loadBusData = async () => {
    try {
      console.log('Loading bus data for:', selectedBusNumber);
      
      let busData = null;
      
      // Try to get specific bus first
      if (selectedBusNumber) {
        try {
          busData = await tvDisplayAPI.getBusByNumber(selectedBusNumber);
          console.log('Loaded specific bus data:', busData);
        } catch (error) {
          console.log('Specific bus not found, trying fallback:', error.message);
        }
      }
      
      // If no specific bus found, get any active bus as fallback
      if (!busData) {
        try {
          const buses = await tvDisplayAPI.getBuses();
          busData = buses.find(bus => bus.status === 'active') || buses[0];
          console.log('Using fallback bus data:', busData);
        } catch (error) {
          console.error('Error fetching buses:', error);
          // Use hardcoded fallback
          busData = {
            bus_number: selectedBusNumber || 'UK-06-J-9102',
            route_name: 'Kashipur - Jaspur',
            start_point: 'Kashipur',
            end_point: 'Jaspur',
            depo: 'Kashipur Depot'
          };
        }
      }

      if (busData) {
        setBusData(busData);
        setNextStop(busData.start_point || 'Loading...');
        setFinalDestination(busData.end_point || 'Loading...');
        
        // Set start and end locations with coordinates
        // You can customize these coordinates based on your actual bus stops
        const locationCoordinates = {
          'Pithoragarh': { lat: 29.2138, lng: 78.9568 },
          'Champawat': { lat: 29.4000, lng: 79.1500 },
          'Kashipur': { lat: 29.2138, lng: 78.9568 },
          'Jaspur': { lat: 29.4000, lng: 79.1500 },
          'Har-ki-Pauri': { lat: 30.0068, lng: 78.1378 },
          'Railway Station': { lat: 29.2500, lng: 79.0000 }
        };
        
        const startCoords = locationCoordinates[busData.start_point] || { lat: 29.2138, lng: 78.9568 };
        const endCoords = locationCoordinates[busData.end_point] || { lat: 29.4000, lng: 79.1500 };
        
        setStartLocation({
          lat: startCoords.lat,
          lng: startCoords.lng,
          name: busData.start_point
        });
        
        setEndLocation({
          lat: endCoords.lat,
          lng: endCoords.lng,
          name: busData.end_point
        });
        
        // Start journey simulation
        if (busData.start_point && busData.end_point) {
          startJourneySimulation(busData.start_point, busData.end_point);
        }
        
        // Set initial GPS coordinates
        setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
        console.log('Started journey simulation for:', busData.start_point, 'to', busData.end_point);
      }
    } catch (error) {
      console.error('Error loading bus data:', error);
      // Use hardcoded fallback on complete failure
      setBusData({
        bus_number: selectedBusNumber || 'UK-06-J-9102',
        route_name: 'Kashipur - Jaspur',
        start_point: 'Kashipur',
        end_point: 'Jaspur',
        depo: 'Kashipur Depot'
      });
      setNextStop('Kashipur');
      setFinalDestination('Jaspur');
      setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
    }
  };

  // Load media content for specific bus/depot
  const loadMediaContent = async () => {
    try {
      console.log('Loading media for bus:', selectedBusNumber);
      
      let media = null;
      let list = [];
      
      // Try to get media specific to the bus first
      if (selectedBusNumber) {
        try {
          // First get the bus data to get the bus ID
          const busData = await tvDisplayAPI.getBusByNumber(selectedBusNumber);
          console.log('Bus data:', busData);
          
          if (busData && busData.id) {
            const mediaData = await tvDisplayAPI.getMediaForBus(busData.id);
            console.log('Bus-specific media data:', mediaData);
            
            if (Array.isArray(mediaData) && mediaData.length > 0) {
              list = mediaData;
              media = mediaData[0];
              console.log('Loaded bus-specific playlist:', mediaData);
            }
          }
        } catch (error) {
          console.log('No bus-specific media found:', error.message);
        }
      }
      
      // If no bus-specific media, get any media
      if (!media) {
        try {
          const mediaData = await tvDisplayAPI.getMedia();
          console.log('All media data from API:', mediaData);
          
          if (Array.isArray(mediaData) && mediaData.length > 0) {
            list = mediaData;
            media = mediaData[0];
            console.log('Selected playlist, first media:', media);
          } else {
            console.log('No media data returned from API');
          }
        } catch (error) {
          console.error('Error fetching media:', error);
        }
      }

      if (media && media.url) {
        console.log('Setting media content:', media);
        // Determine media type based on file extension or type field
        let mediaType = 'video'; // default to video
        
        if (media.type === 'file') {
          // Check file extension to determine if it's video or image
          const url = media.url.toLowerCase();
          if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg') || url.includes('.avi') || url.includes('.mov')) {
            mediaType = 'video';
          } else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')) {
            mediaType = 'image';
          }
        } else {
          mediaType = media.type || 'video';
        }
        
        const normalize = (m) => {
          const url = (m?.url || '').toLowerCase();
          let type = 'video';
          if (m?.type === 'file') {
            if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg') || url.includes('.avi') || url.includes('.mov')) type = 'video';
            else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')) type = 'image';
          } else if (m?.type) {
            type = m.type;
          }
          return { type, url: m.url, name: m.name || 'Media' };
        };

        const normalizedList = (list.length ? list : [media]).map(normalize).filter(x => x.url);

        // If playlist hasn't changed (same urls order), keep current index and item
        const currentUrls = (playlist || []).map(i => i.url);
        const newUrls = normalizedList.map(i => i.url);
        const sameList = currentUrls.length === newUrls.length && currentUrls.every((u, i) => u === newUrls[i]);

        if (sameList && playlist.length > 0) {
          // No change; only ensure mediaContent is set
          if (!mediaContent) {
            setMediaContent(playlist[playlistIndex] || playlist[0]);
          }
        } else {
          setPlaylist(normalizedList);
          setPlaylistIndex(0);
          setMediaContent(normalizedList[0] || null);
        }
      } else {
        console.log('No media found, using demo fallback');
        // Demo fallback - use a reliable video
        setMediaContent({
          type: 'video',
          url: 'https://www.w3schools.com/html/mov_bbb.mp4',
          name: 'Demo Video'
        });
        setPlaylist([{ type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', name: 'Demo Video' }]);
        setPlaylistIndex(0);
      }
    } catch (error) {
      console.error('Error loading media:', error);
      // Demo fallback
      setMediaContent({
        type: 'video',
        url: 'https://www.w3schools.com/html/mov_bbb.mp4',
        name: 'Demo Video'
      });
      setPlaylist([{ type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', name: 'Demo Video' }]);
      setPlaylistIndex(0);
    }
  };

  // Advance playlist
  const advancePlaylist = () => {
    if (!playlist || playlist.length === 0) return;
    const next = (playlistIndex + 1) % playlist.length;
    setPlaylistIndex(next);
    setMediaContent(playlist[next]);
  };

  // For images, rotate every 8 seconds
  useEffect(() => {
    if (!mediaContent) return;
    if (imageTimerRef.current) {
      clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }
    if (mediaContent.type === 'image') {
      imageTimerRef.current = setTimeout(() => {
        advancePlaylist();
      }, 8000);
    }
    return () => {
      if (imageTimerRef.current) {
        clearTimeout(imageTimerRef.current);
        imageTimerRef.current = null;
      }
    };
  }, [mediaContent, playlistIndex]);

  // Load news ticker
  const loadNewsTicker = async () => {
    try {
      const newsData = await tvDisplayAPI.getNews();
      
      if (newsData && newsData.length > 0) {
        const news = newsData[0];
        setTicker(news.title || news.content || 'Welcome to FleetSignage TV Display');
        console.log('Loaded news:', news);
      } else {
        setTicker('Welcome to FleetSignage TV Display');
      }
    } catch (error) {
      console.error('Error loading news:', error);
      setTicker('Welcome to FleetSignage TV Display');
    }
  };

  useEffect(() => {
    loadBusData();
    loadMediaContent();
    loadNewsTicker();

    // Refresh data every 30 seconds
    timerRef.current = setInterval(() => {
      loadBusData();
      loadMediaContent();
      loadNewsTicker();
    }, 30000);

    // Note: Real-time updates are handled by the backend via Socket.io
    // The backend will push updates to connected clients

    return () => {
      clearInterval(timerRef.current);
      if (journeyRef.current) {
        clearInterval(journeyRef.current);
      }
    };
  }, [selectedBusNumber]);

  console.log('Display component rendering with:', { busNumber: selectedBusNumber, depot: selectedDepot, nextStop, finalDestination, ticker });

  return (
    <div className="display-container">
      {/* Main Content Area */}
      <div className="main-content">
        {/* Left Panel - Media Display */}
        <div className="media-panel">
          {console.log('Rendering media:', mediaContent)}
          {mediaContent?.type === 'video' ? (
            <video 
              key={mediaContent.url}
              src={mediaContent.url} 
              className="media-content"
              autoPlay 
              muted 
              playsInline 
              onEnded={advancePlaylist}
              onError={(e) => { console.error('Video load error:', e); advancePlaylist(); }}
              onLoadStart={() => console.log('Video loading started')}
              onCanPlay={() => console.log('Video can play')}
            />
          ) : (
            <img 
              src={mediaContent?.url || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&crop=center'} 
              className="media-content"
              alt="Display content"
              onError={(e) => console.error('Image load error:', e)}
            />
          )}
        </div>

        {/* Right Panel - Information */}
        <div className="info-panel">
          {/* Bus Number Section */}
          <div className="bus-number-section">
            <div className="bus-label">BUS NUMBER</div>
            <div className="bus-number">{selectedBusNumber || 'Not Set'}</div>
            {selectedDepot && (
              <div className="depot-info">Depot: {selectedDepot}</div>
            )}
          </div>

          {/* Map Section */}
          <div className="map-section">
            <div className="map-container">
              <MapboxMap 
                startLocation={startLocation}
                endLocation={endLocation}
                currentLocation={currentLocation}
                journeyProgress={journeyProgress}
                busNumber={selectedBusNumber}
              />
            </div>
          </div>

          {/* Next Stop Section */}
          <div className="stop-section next-stop">
            <div className="stop-label">NEXT STOP</div>
            <div className="stop-name">{nextStop || 'Loading...'}</div>
          </div>

          {/* Final Destination Section */}
          <div className="stop-section final-destination">
            <div className="stop-label">FINAL DESTINATION</div>
            <div className="stop-name">{finalDestination || 'Loading...'}</div>
          </div>
        </div>
      </div>

      {/* Bottom Ticker */}
      <div className="ticker-bar">
        <div className="ticker-content">{ticker}</div>
      </div>
    </div>
  );
};

export default Display;



