import React, { useEffect, useRef, useState } from 'react';
import { tvDisplayAPI } from '../services/api';

const Display = ({ busNumber, depot }) => {
  const selectedBusNumber = busNumber || localStorage.getItem('tv_bus_number') || '';
  const selectedDepot = depot || localStorage.getItem('tv_depot') || '';
  
  // State for bus data from Supabase
  const [busData, setBusData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nextStop, setNextStop] = useState('');
  const [finalDestination, setFinalDestination] = useState('');
  const [ticker, setTicker] = useState('Welcome to FleetSignage TV Display');
  const [mediaContent, setMediaContent] = useState(null);
  
  const timerRef = useRef(null);

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
        
        // Set real GPS coordinates if available
        if (busData.gps_latitude && busData.gps_longitude) {
          setCurrentLocation({ 
            lat: parseFloat(busData.gps_latitude), 
            lng: parseFloat(busData.gps_longitude) 
          });
          console.log('GPS coordinates:', busData.gps_latitude, busData.gps_longitude);
        } else {
          // Fallback coordinates
          setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
        }
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
      
      // Try to get media specific to the bus first
      if (selectedBusNumber) {
        try {
          // First get the bus data to get the bus ID
          const busData = await tvDisplayAPI.getBusByNumber(selectedBusNumber);
          if (busData && busData.id) {
            const mediaData = await tvDisplayAPI.getMediaForBus(busData.id);
            if (mediaData && mediaData.length > 0) {
              media = mediaData[0];
              console.log('Loaded bus-specific media:', media);
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
          if (mediaData && mediaData.length > 0) {
            media = mediaData[0];
            console.log('Loaded general media:', media);
          }
        } catch (error) {
          console.error('Error fetching media:', error);
        }
      }

      if (media) {
        setMediaContent(media);
      } else {
        // Demo fallback - use video for better demo
        setMediaContent({
          type: 'video',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
        });
      }
    } catch (error) {
      console.error('Error loading media:', error);
      // Demo fallback
      setMediaContent({
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      });
    }
  };

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
    };
  }, [selectedBusNumber]);

  console.log('Display component rendering with:', { busNumber: selectedBusNumber, depot: selectedDepot, nextStop, finalDestination, ticker });

  return (
    <div className="display-container">
      {/* Main Content Area */}
      <div className="main-content">
        {/* Left Panel - Media Display */}
        <div className="media-panel">
          {mediaContent?.type === 'video' ? (
            <video 
              src={mediaContent.url} 
              className="media-content"
              autoPlay 
              muted 
              loop 
              playsInline 
            />
          ) : (
            <img 
              src={mediaContent?.url || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&crop=center'} 
              className="media-content"
              alt="Display content"
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
              <div className="map-placeholder">
                <div className="map-marker" style={{
                  left: currentLocation ? '50%' : '50%',
                  top: currentLocation ? '50%' : '50%',
                  backgroundColor: currentLocation ? '#00e0ff' : '#ff6b6b'
                }}></div>
                {currentLocation && (
                  <div className="gps-coordinates">
                    {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                  </div>
                )}
                <div className="map-attribution">Leaflet | © OpenStreetMap contributors</div>
              </div>
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



