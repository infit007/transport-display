import React, { useEffect, useRef, useState } from 'react';
import { tvDisplayAPI } from '../services/api';
import MapboxMap from './MapboxMap';
import io from 'socket.io-client';
import { BACKEND_URL } from '../config/backend-simple.js';

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
  // Used to force re-mount of the video element when looping a single item
  const [reloadNonce, setReloadNonce] = useState(0);
  const prevPlaylistRef = useRef([]);
  const imageTimerRef = useRef(null);
  const [journeyProgress, setJourneyProgress] = useState(0); // 0 to 1
  const [usingDeviceGps, setUsingDeviceGps] = useState(false);
  const [offlinePrepared, setOfflinePrepared] = useState(false);
  
  const timerRef = useRef(null);
  const journeyRef = useRef(null);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const retryRef = useRef({});

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

  // On error, immediately skip to next item to avoid creating many media players
  const skipOnError = () => {
    advancePlaylist();
  };

  // Ensure a URL is cached in the SW cache buckets
  const cacheMediaUrl = async (url) => {
    if (!url) return;
    try {
      const lower = url.toLowerCase();
      const isVideo = ['.mp4', '.webm', '.ogg', '.avi', '.mov'].some(e => lower.includes(e));
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(e => lower.includes(e));
      const cacheName = isVideo ? 'videos' : (isImage ? 'images' : 'runtime');
      const cache = await caches.open(cacheName);
      const req = new Request(url, { mode: 'no-cors' });
      const hit = await cache.match(req);
      if (!hit) {
        const res = await fetch(req).catch(() => null);
        if (res) {
          try { await cache.put(req, res.clone()); } catch {}
        }
      }
    } catch {}
  };

  // Ensure the full playlist is cached, with small concurrency to avoid throttling
  const ensurePlaylistCached = async (urls) => {
    try {
      const list = (urls || []).filter(Boolean).slice(0, 5); // cap to reduce memory pressure
      const concurrency = 3;
      let idx = 0;
      const workers = new Array(concurrency).fill(0).map(async () => {
        while (idx < list.length) {
          const cur = list[idx++];
          await cacheMediaUrl(cur);
        }
      });
      // Do not block playback entirely; race with a timeout so UI proceeds
      await Promise.race([
        Promise.all(workers),
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);
      try { window.localStorage.setItem('offline_playlist', JSON.stringify(list)); } catch {}
      setOfflinePrepared(true);
    } catch {}
  };

  // Warm-up service worker cache with a list of URLs
  const warmupCache = (urls) => {
    try {
      if (!Array.isArray(urls) || urls.length === 0) return;
      if (navigator?.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CACHE_URLS', urls });
      } else if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          try { reg?.active?.postMessage({ type: 'CACHE_URLS', urls }); } catch {}
        });
      }
    } catch {}
  };

  const purgeCache = (urls) => {
    try {
      if (!Array.isArray(urls) || !urls.length) return;
      if (navigator?.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'PURGE_URLS', urls });
      } else if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          try { reg?.active?.postMessage({ type: 'PURGE_URLS', urls }); } catch {}
        });
      }
    } catch {}
  };

  // Prefer real device GPS when available: follow device and route from current position
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    let watchId = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords || {};
          if (typeof latitude === 'number' && typeof longitude === 'number') {
            setUsingDeviceGps(true);
            const loc = { lat: latitude, lng: longitude };
            setCurrentLocation(loc);
            // Use device position as dynamic start for routing
            setStartLocation((prev) => prev ? { ...prev, lat: loc.lat, lng: loc.lng, name: prev.name || 'Current Location' } : { ...loc, name: 'Current Location' });
            // Stop the simulator when we have real GPS
            if (journeyRef.current) {
              clearInterval(journeyRef.current);
              journeyRef.current = null;
            }
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    } catch {}
    return () => {
      try { if (watchId != null) navigator.geolocation.clearWatch(watchId); } catch {}
    };
  }, []);

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
        try { window.localStorage.setItem('last_bus_data', JSON.stringify(busData)); } catch {}
        
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
        if (!usingDeviceGps && busData.start_point && busData.end_point) {
          startJourneySimulation(busData.start_point, busData.end_point);
        }
        
        // Set initial GPS coordinates
        setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
        console.log('Started journey simulation for:', busData.start_point, 'to', busData.end_point);
      }
    } catch (error) {
      console.error('Error loading bus data:', error);
      let cached = null;
      try { cached = JSON.parse(window.localStorage.getItem('last_bus_data') || 'null'); } catch {}
      if (cached) {
        setBusData(cached);
        setNextStop(cached.start_point || 'Loading...');
        setFinalDestination(cached.end_point || 'Loading...');
        setCurrentLocation({ lat: 29.2138, lng: 78.9568 });
      } else {
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
          // If ID path returned empty, try bus-number-based endpoint defensively
          if ((!media || !list?.length) && selectedBusNumber) {
            try {
              const byNumber = await tvDisplayAPI.getMediaForBusNumber(selectedBusNumber);
              if (Array.isArray(byNumber) && byNumber.length) {
                list = byNumber;
                media = byNumber[0];
                console.log('Loaded playlist via bus number endpoint');
              }
            } catch {}
          }
        } catch (error) {
          console.log('No bus-specific media found:', error.message);
        }
      }
      
      // If no bus-specific media, fall back to global public media list
      if (!media) {
        try {
          console.log('No bus-specific media found, falling back to global media list');
          const globalList = await tvDisplayAPI.getMedia();
          if (Array.isArray(globalList) && globalList.length) {
            list = globalList;
            media = globalList[0];
          }
        } catch (e) {
          console.log('Global media fallback failed:', e?.message || e);
        }
        if (!media) {
          console.log('No media found anywhere, clearing playlist');
          setPlaylist([]);
          setMediaContent(null);
          return;
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
          const rawUrl = m?.url || '';
          const url = rawUrl.toLowerCase();
          // Infer by extension first when possible
          const isVideoExt = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.m4v'].some(e => url.includes(e));
          const isImageExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(e => url.includes(e));
          let type = 'video';
          if (isVideoExt) type = 'video';
          else if (isImageExt) type = 'image';
          else if (m?.type) {
            // Fallback to declared type; treat 'link' as video
            type = (m.type === 'link') ? 'video' : m.type;
          }
          return { type, url: rawUrl, name: m?.name || 'Media' };
        };

        // Normalize and de-duplicate by URL while preserving original list order
        const rawList = (list.length ? list : [media]).map(normalize).filter(x => x.url);
        // Filter out items with unknown type
        const filtered = rawList.filter(i => i.type === 'video' || i.type === 'image');
        const seen = new Set();
        const normalizedList = [];
        for (const item of filtered) {
          if (!seen.has(item.url)) {
            seen.add(item.url);
            normalizedList.push(item);
          }
        }

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
          // New playlist - reset to first item
          setPlaylist(normalizedList);
          setPlaylistIndex(0);
          setMediaContent(normalizedList[0] || null);
          console.log('New playlist loaded:', normalizedList.length, 'items');
          // Purge any media that was removed from the playlist
          try {
            const prev = Array.isArray(prevPlaylistRef.current) ? prevPlaylistRef.current : [];
            const newSet = new Set(normalizedList.map(i => i.url));
            const removed = prev.filter(u => !newSet.has(u));
            if (removed.length) purgeCache(removed);
          } catch {}
          prevPlaylistRef.current = normalizedList.map(i => i.url);
        }
        try { window.localStorage.setItem('last_media_playlist', JSON.stringify(normalizedList)); } catch {}
        try { warmupCache(normalizedList.map(i => i.url).filter(Boolean)); } catch {}
        try {
          // Start explicit caching and wait until finished for stronger offline guarantees
          await ensurePlaylistCached(normalizedList.map(i => i.url));
        } catch {}
      } else {
        console.log('No media found, clearing playlist');
        setPlaylist([]);
        setMediaContent(null);
      }
    } catch (error) {
      console.error('Error loading media:', error);
      console.log('Error loading media, clearing playlist');
      setPlaylist([]);
      setMediaContent(null);
    }
  };

  // Advance playlist
  const advancePlaylist = () => {
    if (!playlist || playlist.length === 0) {
      console.log('No playlist to advance');
      return;
    }
    if (playlist.length === 1) {
      // Single-item playlist: explicitly restart the same media
      try {
        const v = videoRef.current;
        if (v && mediaContent?.type === 'video') {
          v.currentTime = 0;
          const p = v.play();
          if (p && typeof p.then === 'function') p.catch(() => {});
        } else {
          // Force remount for images or if no video element yet
          setReloadNonce((n) => n + 1);
        }
      } catch {}
      return;
    }
    const next = (playlistIndex + 1) % playlist.length;
    console.log(`🔄 Advancing playlist: ${playlistIndex} -> ${next} (${playlist.length} total items)`);
    console.log(`📺 Current video: ${mediaContent?.name || 'Unknown'}`);
    console.log(`📺 Next video: ${playlist[next]?.name || 'Unknown'}`);
    setPlaylistIndex(next);
    setMediaContent(playlist[next]);
  };

  // Auto-advance media: images rotate every 8s; videos advance only when ended
  useEffect(() => {
    if (!mediaContent || !playlist || playlist.length <= 1) return;
    
    if (imageTimerRef.current) {
      clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }
    
    if (mediaContent.type === 'image') {
      imageTimerRef.current = setTimeout(() => {
        advancePlaylist();
        }, 5000);
    } else if (mediaContent.type === 'video') {
      // Add a safety timeout for videos (in case all other mechanisms fail)
      imageTimerRef.current = setTimeout(() => {
        console.log('⏰ Video safety timeout reached, advancing playlist');
        advancePlaylist();
      }, 60000); // 60 seconds max per video
    }
    
    return () => {
      if (imageTimerRef.current) {
        clearTimeout(imageTimerRef.current);
        imageTimerRef.current = null;
      }
    };
  }, [mediaContent, playlistIndex, playlist]);

  // Safety: ensure videos advance; use conservative stall handling
  useEffect(() => {
    const v = videoRef.current;
    if (!v || mediaContent?.type !== 'video') return;

    let hasAdvanced = false; // Prevent double advancement
    let stallTimer = null;

    const clearStallTimer = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };

    const onTime = () => {
      try {
        if (!isFinite(v.duration) || v.duration === 0) return;
        if (v.currentTime >= v.duration - 0.1 && !hasAdvanced) {
          console.log('⚠️ Video near end, advancing as safety measure');
          hasAdvanced = true;
          advancePlaylist();
        }
      } catch {}
    };

    const scheduleStallAdvance = () => {
      if (hasAdvanced || stallTimer) return;
      stallTimer = setTimeout(() => {
        if (!hasAdvanced) {
          console.log('⚠️ Video stall timeout, advancing');
          hasAdvanced = true;
          advancePlaylist();
        }
      }, 5000);
    };

    const onWaiting = () => scheduleStallAdvance();
    const onStalled = () => scheduleStallAdvance();
    const onPlaying = () => clearStallTimer();
    const onProgress = () => clearStallTimer();

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('stalled', onStalled);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('progress', onProgress);

    return () => {
      try {
        clearStallTimer();
        v.removeEventListener('timeupdate', onTime);
        v.removeEventListener('waiting', onWaiting);
        v.removeEventListener('stalled', onStalled);
        v.removeEventListener('playing', onPlaying);
        v.removeEventListener('progress', onProgress);
      } catch {}
    };
  }, [mediaContent?.url, playlistIndex]);

  // Startup watchdog: if a new video fails to reach a playable state within 8s, skip it
  useEffect(() => {
    if (mediaContent?.type !== 'video') return;
    const v = videoRef.current;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const ready = v?.readyState || 0; // HAVE_NOTHING=0 .. HAVE_ENOUGH_DATA=4
        const canPlay = ready >= 2 && !v?.paused;
        if (!canPlay) {
          console.warn('⏱️ Video startup watchdog advancing (not playable within 8s)');
          advancePlaylist();
        }
      } catch {
        advancePlaylist();
      }
    }, 8000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [mediaContent?.url, reloadNonce, playlistIndex]);

  // Removed explicit teardown on playlistIndex change because the ref points to the new element
  // and clearing src on the new element can prevent it from loading, leading to black frames.

  // Load news ticker
  const loadNewsTicker = async () => {
    try {
      const newsData = await tvDisplayAPI.getNews();
      
      if (newsData && newsData.length > 0) {
        const news = newsData[0];
        setTicker(news.title || news.content || 'Welcome to FleetSignage TV Display');
        console.log('Loaded news:', news);
        try { window.localStorage.setItem('last_news', news.title || news.content || 'Welcome to FleetSignage TV Display'); } catch {}
      } else {
        setTicker('Welcome to FleetSignage TV Display');
      }
    } catch (error) {
      console.error('Error loading news:', error);
      let cached = null;
      try { cached = window.localStorage.getItem('last_news'); } catch {}
      setTicker(cached || 'Welcome to FleetSignage TV Display');
    }
  };

  // Initialize Socket.io connection for real-time updates
  useEffect(() => {
    const backendUrl = BACKEND_URL;
    socketRef.current = io(backendUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Basic connection lifecycle logging
    socketRef.current.on('connect', () => {
      console.log('Socket connected', socketRef.current.id);
      try {
        // Try common subscribe/join patterns so backend can target this device
        const payload = { busNumber: selectedBusNumber, depot: selectedDepot };
        socketRef.current.emit('subscribe', payload);
        socketRef.current.emit('join', payload);
        socketRef.current.emit('tv:register', payload);
        
        // Join specific rooms for targeted updates
        if (selectedBusNumber) {
          socketRef.current.emit('join', { busNumber: selectedBusNumber });
        }
        if (selectedDepot) {
          socketRef.current.emit('join', { depot: selectedDepot });
        }
      } catch {}
    });
    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected', reason);
    });
    socketRef.current.on('connect_error', (err) => {
      console.log('Socket connect_error', err?.message || err);
    });
    socketRef.current.on('error', (err) => {
      console.log('Socket error', err?.message || err);
    });

    // Helper to react to any media update signal
    const onMediaUpdate = (data) => {
      console.log('Received media update:', data);
      
      // Check if this update is targeted to this bus
      if (data.busNumber && selectedBusNumber && data.busNumber !== selectedBusNumber) {
        console.log('Media update not for this bus:', data.busNumber, 'vs', selectedBusNumber);
        return;
      }
      
      if (data.busId && busData && data.busId !== busData.id) {
        console.log('Media update not for this bus ID:', data.busId, 'vs', busData?.id);
        return;
      }
      
      console.log('Media update is for this bus, reloading content...');
      
      // Clear current playlist immediately
      setPlaylist([]);
      setMediaContent(null);
      setPlaylistIndex(0);
      
      try {
        const currentUrls = Array.isArray(playlist) ? playlist.map(i => i?.url).filter(Boolean) : [];
        if (currentUrls.length) purgeCache(currentUrls);
      } catch {}
      
      // Force reload media content when new media is pushed
      setTimeout(() => {
        loadMediaContent();
      }, 500); // Small delay to ensure backend has processed the changes
      
      // Extra: try a few more refreshes in the next 20s in case backend is still processing
      try {
        let n = 3;
        const interval = setInterval(() => {
          if (--n <= 0) { clearInterval(interval); return; }
          loadMediaContent();
        }, 5000);
      } catch {}
    };

    // Listen for media updates on multiple possible channels
    socketRef.current.on('media:update', onMediaUpdate);
    socketRef.current.on('media:refresh', onMediaUpdate);
    socketRef.current.on('playlist:update', onMediaUpdate);

    // Listen for news updates
    socketRef.current.on('news:broadcast', (payload) => {
      console.log('Received news update:', payload);
      // Check if this news is targeted to this bus/depot
      const targets = payload?.targets || {};
      const deviceIds = Array.isArray(targets.deviceIds) ? targets.deviceIds : [];
      const depots = Array.isArray(targets.depots) ? targets.depots : [];
      
      const matchesDevice = deviceIds.length === 0 || 
        (selectedBusNumber && deviceIds.includes(selectedBusNumber));
      const matchesDepot = depots.length === 0 || 
        (selectedDepot && depots.includes(selectedDepot));
      
      if (matchesDevice && matchesDepot) {
        const text = payload?.title || payload?.content || 'Welcome to FleetSignage TV Display';
        setTicker(text);
        try { window.localStorage.setItem('last_news', text); } catch {}
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [selectedBusNumber, selectedDepot]);

  useEffect(() => {
    loadBusData();
    loadMediaContent();
    loadNewsTicker();
    // On startup, also ensure any previously saved offline playlist is cached
    try {
      const prev = JSON.parse(window.localStorage.getItem('offline_playlist') || '[]');
      if (Array.isArray(prev) && prev.length) { ensurePlaylistCached(prev); }
    } catch {}

    // Refresh data periodically for resiliency (socket handles immediate media changes)
    timerRef.current = setInterval(() => {
      loadBusData();
      loadNewsTicker();
    }, 60000);

    return () => {
      clearInterval(timerRef.current);
      if (journeyRef.current) {
        clearInterval(journeyRef.current);
      }
    };
  }, [selectedBusNumber]);

  console.log('Display component rendering with:', { 
    busNumber: selectedBusNumber, 
    depot: selectedDepot, 
    nextStop, 
    finalDestination, 
    ticker,
    playlistLength: playlist?.length || 0,
    currentIndex: playlistIndex,
    currentMedia: mediaContent?.name || 'None'
  });

  return (
    <div className="display-container">
      {/* Main Content Area */}
      <div className="main-content">
        {/* Left Panel - Media Display */}
        <div className="media-panel">
          {console.log('Rendering media:', mediaContent)}
          {mediaContent?.type === 'video' ? (
            <video 
              src={mediaContent.url} 
              className="media-content"
              autoPlay 
              muted 
              playsInline 
              preload="metadata"
              controls={false}
              crossOrigin="anonymous"
              ref={videoRef}
              onEnded={() => {
                console.log('🎬 Video ended, advancing to next');
                advancePlaylist();
              }}
              onError={() => { skipOnError(); }}
              onLoadedMetadata={(e) => {
                try {
                  const v = e.currentTarget;
                  // Ensure playback from start and remove any stalled state
                  v.currentTime = 0;
                } catch {}
              }}
              onLoadedData={(e) => {
                try {
                  const v = e.currentTarget;
                  const p = v.play();
                  if (p && typeof p.then === 'function') p.catch(() => advancePlaylist());
                } catch { advancePlaylist(); }
              }}
              onCanPlay={(e) => {
                try {
                  const v = e.currentTarget;
                  console.log(`▶️ Video can play: ${mediaContent?.name} (${v.duration}s)`);
                  const playPromise = v.play();
                  if (playPromise && typeof playPromise.then === 'function') playPromise.catch(() => advancePlaylist());
                } catch {
                  advancePlaylist();
                }
              }}
            />
          ) : (
            <img 
              src={mediaContent?.url || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&crop=center'} 
              className="media-content image"
              alt="Display content"
              crossOrigin="anonymous"
              onError={() => {
                console.error('Image load error, advancing to next');
                advancePlaylist();
              }}
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



