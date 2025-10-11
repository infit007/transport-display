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

  // Load bus data from Supabase
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
      // Fetch bus data from Supabase
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
        setBusData(buses);
        setNextStop(buses.current_location || buses.start_point || '');
        setFinalDestination(buses.end_point || '');
        
        // Set demo coordinates for current location
        setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
      } else {
        // Use demo data if bus not found
        setBusData({
          bus_number: selectedBusNumber || 'UK-01-A-1001',
          route_name: 'Demo Route',
          start_point: 'Dehradun',
          end_point: 'Haridwar',
          current_location: 'Kashipur'
        });
        setNextStop('Kashipur');
        setFinalDestination('Jaspur');
        setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
      }
    } catch (error) {
      console.error('Error loading bus data:', error);
    }
  };

  // Load media content
  const loadMediaContent = async () => {
    if (!supabase) {
      // Demo media content
      setMediaContent({
        type: 'image',
        url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&crop=center'
      });
      return;
    }

    try {
      const { data: media, error } = await supabase
        .from('media_content')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching media:', error);
        return;
      }

      if (media) {
        setMediaContent(media);
      } else {
        // Demo fallback
        setMediaContent({
          type: 'image',
          url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&crop=center'
        });
      }
    } catch (error) {
      console.error('Error loading media:', error);
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, (payload) => {
          if (payload.new?.bus_number === selectedBusNumber) {
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
          {/* Map Section */}
          <div className="map-section">
            <div className="map-container">
              <div className="map-placeholder">
                <div className="map-marker"></div>
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



