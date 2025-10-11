import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

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

  // Load bus data from Supabase with real-time GPS
  const loadBusData = async () => {
    if (!supabase) {
      console.log('Supabase not configured, using demo data');
      setBusData({
        bus_number: selectedBusNumber || 'UK-01-A-1001',
        route_name: 'Dehradun - Haridwar',
        start_point: 'Dehradun',
        end_point: 'Haridwar',
        current_location: 'Kashipur',
        next_stop: 'Kashipur',
        final_destination: 'Jaspur'
      });
      setNextStop('Kashipur');
      setFinalDestination('Jaspur');
      setCurrentLocation({ lat: 29.2138, lng: 78.9568 }); // Kashipur coordinates
      return;
    }

    try {
      // Fetch bus data from Supabase with GPS coordinates
      const { data: buses, error } = await supabase
        .from('buses')
        .select('*')
        .eq('bus_number', selectedBusNumber)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching bus data:', error);
        return;
      }

      if (buses) {
        console.log('Loaded bus data:', buses);
        setBusData(buses);
        
        // Set next stop and destination from actual bus data
        setNextStop(buses.start_point || 'Loading...');
        setFinalDestination(buses.end_point || 'Loading...');
        
        // Set real GPS coordinates if available
        if (buses.gps_latitude && buses.gps_longitude) {
          setCurrentLocation({ 
            lat: parseFloat(buses.gps_latitude), 
            lng: parseFloat(buses.gps_longitude) 
          });
          console.log('GPS coordinates:', buses.gps_latitude, buses.gps_longitude);
        } else {
          // Fallback to demo coordinates
          setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
        }
      } else {
        // Use demo data if bus not found
        setBusData({
          bus_number: selectedBusNumber || 'UK-01-A-1001',
          route_name: 'Demo Route',
          start_point: 'Dehradun',
          end_point: 'Haridwar',
          current_location: 'Kashipur'
        });
        setNextStop('Dehradun');
        setFinalDestination('Haridwar');
        setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
      }
    } catch (error) {
      console.error('Error loading bus data:', error);
    }
  };

  // Load media content for specific bus/depot
  const loadMediaContent = async () => {
    if (!supabase) {
      // Demo media content - prioritize video for demo
      setMediaContent({
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      });
      return;
    }

    try {
      // First try to get media specific to the bus number
      let query = supabase
        .from('media_content')
        .select('*')
        .eq('is_active', true);

      // If we have a bus number, try to get media for that specific bus
      if (selectedBusNumber) {
        query = query.or(`target_buses.cs.{${selectedBusNumber}},target_depots.cs.{${selectedDepot}}`);
      } else if (selectedDepot) {
        // If no bus number but have depot, get media for that depot
        query = query.contains('target_depots', [selectedDepot]);
      }

      const { data: media, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching media:', error);
        // Fallback to any active media
        const { data: fallbackMedia } = await supabase
          .from('media_content')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (fallbackMedia) {
          setMediaContent(fallbackMedia);
        } else {
          // Final fallback to demo video
          setMediaContent({
            type: 'video',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
          });
        }
        return;
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
    if (!supabase) {
      setTicker('Welcome to FleetSignage TV Display - Demo Mode');
      return;
    }

    try {
      const { data: news, error } = await supabase
        .from('news_feeds')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching news:', error);
        return;
      }

      if (news) {
        setTicker(news.title || news.content || 'Welcome to FleetSignage TV Display');
      } else {
        setTicker('Welcome to FleetSignage TV Display');
      }
    } catch (error) {
      console.error('Error loading news:', error);
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

    // Subscribe to real-time updates
    if (supabase) {
      const channel = supabase
        .channel('tv-updates')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'buses',
          filter: `bus_number=eq.${selectedBusNumber}`
        }, (payload) => {
          console.log('Bus location update received:', payload);
          const bus = payload.new || payload.old;
          if (bus && bus.bus_number === selectedBusNumber) {
            // Update GPS coordinates in real-time
            if (bus.gps_latitude && bus.gps_longitude) {
              setCurrentLocation({ 
                lat: parseFloat(bus.gps_latitude), 
                lng: parseFloat(bus.gps_longitude) 
              });
              console.log('Updated GPS coordinates:', bus.gps_latitude, bus.gps_longitude);
            }
            
            // Update other bus data
            if (bus.start_point) setNextStop(bus.start_point);
            if (bus.end_point) setFinalDestination(bus.end_point);
            
            // Reload full bus data
            loadBusData();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'news_feeds' }, (payload) => {
          const row = payload.new || {};
          if (row.is_active) {
            setTicker(row.title || row.content || '');
          }
        })
        .subscribe();

      return () => {
        clearInterval(timerRef.current);
        supabase.removeChannel(channel);
      };
    }

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



