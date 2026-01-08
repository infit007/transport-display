// Display.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { tvDisplayAPI } from "../services/api";
import MapboxMap from "./MapboxMap";
import io from "socket.io-client";
import { BACKEND_URL } from "../config/backend-simple.js";
import { useLocation } from "../context/LocationContext.jsx";

const Display = ({ busNumber, depot }) => {
  const selectedBusNumber =
    busNumber || localStorage.getItem("tv_bus_number") || "";
  const selectedDepot = depot || localStorage.getItem("tv_depot") || "";

  // Data
  const [busData, setBusData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null); // { lat, lng, ts }
  const [startLocation, setStartLocation] = useState(null); // { lat, lng, name }
  const [endLocation, setEndLocation] = useState(null); // { lat, lng, name }
  const [nextStop, setNextStop] = useState("");
  const [finalDestination, setFinalDestination] = useState("");
  const [routeKey, setRouteKey] = useState(0); // Force route rebuild when locations change

  // Media / ticker
  const [ticker, setTicker] = useState(""); // no default text shown unless API pushes one
  const [mediaContent, setMediaContent] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);

  const prevPlaylistRef = useRef([]);
  const imageTimerRef = useRef(null);
  const timerRef = useRef(null);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const lastLivePositionRef = useRef(null);
  const tickerTrackRef = useRef(null);
  const tickerAnimRef = useRef(null);

  // Global device GPS (context)
  const { position: devicePosition, error: deviceError, permission, isWatching } = useLocation();

  // Prefer devicePosition from context, fall back to server/bus currentLocation
  const effectiveCurrentLocation = useMemo(() => {
    return devicePosition || currentLocation;
  }, [devicePosition, currentLocation]);

  
  // Mobile-only responsive overrides to enlarge the map on landscape phones
useEffect(() => {
  const id = "mobile-tv-layout";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
  style.innerHTML = `
  /* Hide BUS NUMBER label everywhere; keep only the number */
  .bus-number-section .bus-label { display: none !important; }
  /* Hide the whole BUS NUMBER block globally; we'll show a compact badge on the map */
  .bus-number-section { display: none !important; }
/* Desktop / large TV screens: larger ticker */

  /* Global bus badge overlay on the map */
  .ticker-bar .ticker-content { 
  font-size: inherit !important;
  padding: 0 16px; 
}

  .map-container { position: relative; }
  .bus-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0,0,0,0.72);
    color: #ffffff;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 29px;
    font-weight: 800;
    line-height: 1;
    z-index: 10;
    pointer-events: none;
  }
    

  /* Mobile landscape: 2/3 media on left, 1/3 info on right */
  @media (max-width: 900px) and (orientation: landscape) {
    .main-content {
      height: calc(100vh - 26px);
      display: grid !important;
      grid-template-columns: 66.666% 33.334% !important; /* media | info */
      grid-template-rows: 1fr !important;
      column-gap: 8px;
      align-items: stretch;
    }

    .media-panel {
      grid-column: 1;
      grid-row: 1 !important;
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      display: flex !important;
      position: relative !important;
      background: #000;
    }
    .media-panel .media-content,
    .media-panel video.media-content,
    .media-panel img.media-content {
      position: absolute !important;
      inset: 0;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: center center !important;
      display: block !important;
    }

    .info-panel {
      grid-column: 2;
      grid-row: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      min-height: 0 !important;
    }
    .map-section { flex: 1 1 auto !important; min-height: 0 !important; height: auto !important; }
    .stop-section { height: 6vh; padding: 4px 8px; }
  }
 /* Ticker: pin to bottom and enable seamless marquee for long text */
  .ticker-bar { left: 0; right: 0; width: 100%; box-shadow: 0 -1px 0 rgba(255,255,255,0.08); overflow: hidden; display: flex; align-items: center; }
  .ticker-bar .ticker-track { display: inline-flex; white-space: nowrap; gap: 0; padding: 0; will-change: transform; width: max-content; flex: 0 0 auto; }
  .ticker-bar .ticker-item { white-space: nowrap; padding: 0 32px; display: block; }
  @keyframes ticker-marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  @media (max-width: 900px) {
    .display-container {
      height: 100vh;
      padding: 0 !important;
      overflow: hidden;
    }

    .main-content {
      height: calc(100vh - 34px);
      display: grid !important;
      grid-template-rows: 60vh 18vh 14vh !important;
    }

    .media-panel {
      grid-row: 2;
    }

    .media-panel {
      height: 18vh !important;
      overflow: hidden !important;
      display: flex !important;
      position: relative !important;
      background: #000;
    }
    .media-panel .media-content {
      position: absolute !important;
      top: 0; left: 0; right: 0; bottom: 0;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      flex: 1 1 auto !important;
      display: block !important;
      object-position: center center !important;
      /* Slight mobile-only zoom to crop intrinsic letterboxing inside some creatives */
      transform: scale(1.08);
      transform-origin: center center;
    }

    .info-panel {
      grid-row: 1 / span 3;
      display: flex;
      flex-direction: column;
    }

    .bus-number-section { display:none!important; }

    .map-section { height: 60vh !important; min-height: 60vh !important; }

    /* Bus badge overlay on the map for mobile */
    .map-container { position: relative !important; }
    .bus-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 800;
      z-index: 5;
      pointer-events: none;
    }

    .stop-section { height: 7vh; padding: 4px 10px; background: #000; }

    .stop-name {
      font-size: 18px !important;
      color: #00ffe1;
      font-weight: bold;
    }

    .ticker-bar {
      position: fixed;
      bottom: 0;
      height: 34px;
      font-size: 15px;
      background: black;
      z-index: 999;
    }
  }

  /* Very short landscape (e.g., iPhone 12 Pro 844x390) */
  @media (max-width: 900px) and (max-height: 420px) and (orientation: landscape) {
    .main-content {
      height: calc(100vh - 24px);
      display: grid !important;
      grid-template-columns: 66.666% 33.334% !important; /* media | info (map+stops) */
      grid-template-rows: 1fr !important; /* single row */
      /* ensure previous row template from mobile block doesn't interfere */
      row-gap: 0 !important;
      column-gap: 8px;
      align-items: stretch;
    }
    .media-panel {
      grid-column: 1;
      grid-row: 1 !important;
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      display: flex !important;
      align-self: stretch !important;
      background: #000;
      position: relative !important;
    }
    .media-panel video.media-content,
    .media-panel img.media-content,
    .media-panel .media-content {
      position: absolute !important;
      top: 0; left: 0; right: 0; bottom: 0;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      object-fit: cover !important;
      object-position: center center !important;
      flex: 1 1 auto !important;
      display: block !important;
      /* Slightly stronger zoom on ultra-short landscape to eliminate visible bars */
      transform: scale(1.12);
      transform-origin: center center;
    }
    .info-panel { grid-column: 2; display: flex; flex-direction: column; min-height: 0; }
    .map-section { height: 58vh !important; min-height: 58vh !important; }
    .stop-section { height: 5.5vh; padding: 4px 8px; }
    .stop-section .stop-label { font-size: 10px !important; }
    .stop-section .stop-name { font-size: 15px !important; line-height: 1.1 !important; }
    .bus-badge { font-size: 12px; top: 6px; left: 6px; padding: 4px 8px; }
    .ticker-bar { height: 24px !important; font-size: 13px !important; }
  }

  /* Laptop/tablet landscape tweaks to slim bars and give map more space */
  @media (min-width: 901px) and (max-width: 1366px) and (orientation: landscape) {
   .bus-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 18px;
      font-weight: 800;
      z-index: 5;
      pointer-events: none;
    }
    .info-panel { padding: 8px 8px 0 !important; }
    .bus-number-section { padding: 6px 8px !important; }
    .map-section { height: 55vh !important; min-height: 55vh !important; }
    .stop-section { padding: 6px 10px !important; }
    .stop-section .stop-label { font-size: 11px !important; }
    .stop-section .stop-name { font-size: 18px !important; line-height: 0.8 !important; }
    .ticker-bar { height: 50px !important; font-size: 22px !important; }
    .ticker-bar .ticker-content { font-weight: 600; letter-spacing: 0.2px; }
  }

  /* Desktop / large TV screens: larger ticker */
  @media (min-width: 1367px) {
    .ticker-bar { height: 80px !important; font-size: 50px !important; }
    .ticker-bar .ticker-content { padding: 0 16px; font-weight: 600; letter-spacing: 0.2px; }
  }
  `
  ;
  document.head.appendChild(style);
}, []);


  useEffect(() => {
    if (devicePosition) {
      console.log("[Display] Device GPS (context)", devicePosition);
    }
  }, [devicePosition]);

  useEffect(() => {
    if (deviceError) {
      console.error("[Display] Device GPS error (context)", deviceError);
    }
  }, [deviceError]);

  // Always-moving ticker marquee (broadcast style): continuous crawl even for short text
  useEffect(() => {
    const el = tickerTrackRef.current;
    if (!el) return;
    const bar = el.closest('.ticker-bar');
    if (!bar) return;

    try { tickerAnimRef.current?.cancel?.(); } catch {}

    const start = () => {
      try {
        // Cancel any previous animation
        try { tickerAnimRef.current?.cancel?.(); } catch {}

        const first = el.querySelector('.ticker-item');
        if (!first) return;

        const textWidth = first.scrollWidth || 0;
        const boxWidth = bar.clientWidth || 0;

        // Force minimum loop width so short text still scrolls
        const loopWidth = Math.max(textWidth, boxWidth + 200);

        // Ensure we have enough travel distance inside the track
        el.style.animation = 'none';
        el.style.paddingRight = loopWidth + 'px';

        const speed = window.innerWidth >= 1367 ? 80 : 60; // px/sec
        const duration = Math.max(12, Math.round(loopWidth / speed));

        tickerAnimRef.current = el.animate(
          [
            { transform: `translateX(${boxWidth}px)` },
            { transform: `translateX(-${loopWidth}px)` }
          ],
          {
            duration: duration * 1000,
            iterations: Infinity,
            easing: 'linear',
            fill: 'both',
          }
        );
      } catch {}
    };

    start();
    window.addEventListener('resize', start);
    return () => {
      window.removeEventListener('resize', start);
      try { tickerAnimRef.current?.cancel?.(); } catch {}
    };
  }, [ticker]);

  useEffect(() => {
    console.log("[Display] GPS watch status:", { permission, isWatching });
  }, [permission, isWatching]);

  // Helpers
  const isValidCoord = (lat, lng) =>
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  // ---- Media caching helpers (unchanged logic) ----
  const cacheMediaUrl = async (url) => {
    if (!url) return;
    try {
      const lower = url.toLowerCase();
      const isVideo = [".mp4", ".webm", ".ogg", ".avi", ".mov", ".m4v"].some(
        (e) => lower.includes(e)
      );
      const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp"].some((e) =>
        lower.includes(e)
      );
      const cacheName = isVideo ? "videos" : isImage ? "images" : "runtime";
      const cache = await caches.open(cacheName);
      const req = new Request(url, { mode: "no-cors" });
      const hit = await cache.match(req);
      if (!hit) {
        const res = await fetch(req).catch(() => null);
        if (res) {
          try {
            await cache.put(req, res.clone());
          } catch {}
        }
      }
    } catch {}
  };

  const ensurePlaylistCached = async (urls, waitAll = false) => {
    try {
      const list = (urls || []).filter(Boolean);
      const concurrency = waitAll ? 2 : 3;
      let idx = 0;
      const workers = new Array(concurrency).fill(0).map(async () => {
        while (idx < list.length) {
          const cur = list[idx++];
          await cacheMediaUrl(cur);
        }
      });
      if (waitAll) await Promise.all(workers);
      else
        await Promise.race([
          Promise.all(workers),
          new Promise((r) => setTimeout(r, 5000)),
        ]);
      try {
        window.localStorage.setItem("offline_playlist", JSON.stringify(list));
      } catch {}
    } catch {}
  };

  const warmupCache = (urls) => {
    try {
      if (!Array.isArray(urls) || urls.length === 0) return;
      if (navigator?.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CACHE_URLS",
          urls,
        });
      } else if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          try {
            reg?.active?.postMessage({ type: "CACHE_URLS", urls });
          } catch {}
        });
      }
    } catch {}
  };

  const purgeCache = (urls) => {
    try {
      if (!Array.isArray(urls) || !urls.length) return;
      if (navigator?.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "PURGE_URLS",
          urls,
        });
      } else if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          try {
            reg?.active?.postMessage({ type: "PURGE_URLS", urls });
          } catch {}
        });
      }
    } catch {}
  };

  // Keep server/bus GPS updates visible in logs
  useEffect(() => {
    if (currentLocation) {
      console.log("[Display] Bus/server GPS", currentLocation);
    }
  }, [currentLocation]);

  // ---- Load bus data (NO fallbacks) ----
  const loadBusData = async () => {
    try {
      if (!selectedBusNumber) return;

      let bus = null;
      try {
        bus = await tvDisplayAPI.getBusByNumber(selectedBusNumber);
      } catch (error) {
        console.log("Bus not found:", error?.message || error);
      }

      if (!bus) {
        setBusData(null);
        setStartLocation(null);
        setEndLocation(null);
        setNextStop("");
        setFinalDestination("");
        return;
      }

      setBusData(bus);
      setNextStop(bus.start_point || "");
      setFinalDestination(bus.end_point || "");
      try {
        window.localStorage.setItem("last_bus_data", JSON.stringify(bus));
      } catch {}

      const sLat = Number(bus.start_latitude);
      const sLng = Number(bus.start_longitude);
      const eLat = Number(bus.end_latitude);
      const eLng = Number(bus.end_longitude);

      const newStartLocation = isValidCoord(sLat, sLng)
        ? { lat: sLat, lng: sLng, name: bus.start_point || "" }
        : null;
      const newEndLocation = isValidCoord(eLat, eLng)
        ? { lat: eLat, lng: eLng, name: bus.end_point || "" }
        : null;
      
      setStartLocation(newStartLocation);
      setEndLocation(newEndLocation);
      
      // Force route rebuild by incrementing routeKey when locations change
      // This ensures the route updates immediately without page reload
      if (newStartLocation && newEndLocation) {
        setRouteKey(prev => prev + 1);
        console.log('[Display] Locations updated, routeKey incremented to force rebuild', {
          start: newStartLocation.name,
          end: newEndLocation.name,
          routeKey: routeKey + 1
        });
      }

      const gLat = Number(bus.gps_latitude);
      const gLng = Number(bus.gps_longitude);
      if (isValidCoord(gLat, gLng)) {
        const pos = { lat: gLat, lng: gLng, ts: Date.now() };
        setCurrentLocation(pos);
        lastLivePositionRef.current = pos;
      }
    } catch (error) {
      console.error("Error loading bus data:", error);
    }
  };

  // ---- Load media (same logic, no hard fallbacks other than cached) ----
  const loadMediaContent = async () => {
    try {
      let media = null;
      let list = [];

      try {
        if (
          typeof navigator !== "undefined" &&
          navigator &&
          navigator.onLine === false
        ) {
          const cachedList = JSON.parse(
            window.localStorage.getItem("last_media_playlist") || "[]"
          );
          if (Array.isArray(cachedList) && cachedList.length) {
            setPlaylist(cachedList);
            setPlaylistIndex(0);
            setMediaContent(cachedList[0] || null);
            try {
              await ensurePlaylistCached(cachedList.map((i) => i.url));
            } catch {}
            return;
          }
        }
      } catch {}

      if (selectedBusNumber) {
        try {
          const bus = await tvDisplayAPI.getBusByNumber(selectedBusNumber);
          if (bus && bus.id) {
            const mediaData = await tvDisplayAPI.getMediaForBus(bus.id);
            if (Array.isArray(mediaData) && mediaData.length) {
              list = mediaData;
              media = mediaData[0];
            }
          }
          if ((!media || !list?.length) && selectedBusNumber) {
            try {
              const byNumber = await tvDisplayAPI.getMediaForBusNumber(
                selectedBusNumber
              );
              if (Array.isArray(byNumber) && byNumber.length) {
                list = byNumber;
                media = byNumber[0];
              }
            } catch {}
          }
        } catch (e) {}
      }

      if (!media) {
        try {
          const globalList = await tvDisplayAPI.getMedia();
          if (Array.isArray(globalList) && globalList.length) {
            list = globalList;
            media = globalList[0];
          }
        } catch {}
        if (!media) {
          setPlaylist([]);
          setMediaContent(null);
          return;
        }
      }

      const normalize = (m) => {
        const rawUrl = m?.url || "";
        const url = rawUrl.toLowerCase();
        const isVideo = [".mp4", ".webm", ".ogg", ".avi", ".mov", ".m4v"].some(
          (e) => url.includes(e)
        );
        const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp"].some((e) =>
          url.includes(e)
        );
        let type = isVideo
          ? "video"
          : isImage
          ? "image"
          : m?.type === "link"
          ? "video"
          : m?.type || "video";
        return { type, url: rawUrl, name: m?.name || "Media" };
      };

      const normalizedList = (list.length ? list : [media])
        .map(normalize)
        .filter((x) => x.url);
      const seen = new Set();
      const deduped = [];
      for (const item of normalizedList) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          deduped.push(item);
        }
      }

      const currentUrls = (playlist || []).map((i) => i.url);
      const newUrls = deduped.map((i) => i.url);
      const same =
        currentUrls.length === newUrls.length &&
        currentUrls.every((u, i) => u === newUrls[i]);

      if (same && playlist.length > 0) {
        if (!mediaContent)
          setMediaContent(playlist[playlistIndex] || playlist[0]);
      } else {
        setPlaylist(deduped);
        setPlaylistIndex(0);
        setMediaContent(deduped[0] || null);
        try {
          const prev = Array.isArray(prevPlaylistRef.current)
            ? prevPlaylistRef.current
            : [];
          const newSet = new Set(deduped.map((i) => i.url));
          const removed = prev.filter((u) => !newSet.has(u));
          if (removed.length) purgeCache(removed);
        } catch {}
        prevPlaylistRef.current = deduped.map((i) => i.url);
      }

      try {
        window.localStorage.setItem(
          "last_media_playlist",
          JSON.stringify(deduped)
        );
      } catch {}
      try {
        warmupCache(deduped.map((i) => i.url).filter(Boolean));
      } catch {}
      try {
        await ensurePlaylistCached(
          deduped.map((i) => i.url),
          true
        );
      } catch {}
    } catch (error) {
      console.error("Error loading media:", error);
      try {
        const cached = JSON.parse(
          window.localStorage.getItem("last_media_playlist") || "[]"
        );
        if (Array.isArray(cached) && cached.length) {
          setPlaylist(cached);
          setPlaylistIndex(0);
          setMediaContent(cached[0] || null);
          return;
        }
      } catch {}
      setPlaylist([]);
      setMediaContent(null);
    }
  };

  // ---- Playlist advance ----
  const advancePlaylist = () => {
    if (!playlist || playlist.length === 0) return;
    if (playlist.length === 1) {
      try {
        const v = videoRef.current;
        if (v && mediaContent?.type === "video") {
          v.currentTime = 0;
          const p = v.play();
          if (p && typeof p.then === "function") p.catch(() => {});
        } else {
          setReloadNonce((n) => n + 1);
        }
      } catch {}
      return;
    }
    const next = (playlistIndex + 1) % playlist.length;
    setPlaylistIndex(next);
    setMediaContent(playlist[next]);
  };

  useEffect(() => {
    if (!mediaContent || !playlist || playlist.length <= 1) return;
    if (imageTimerRef.current) {
      clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }
    if (mediaContent.type === "image") {
      imageTimerRef.current = setTimeout(advancePlaylist, 5000);
    } else if (mediaContent.type === "video") {
      imageTimerRef.current = setTimeout(advancePlaylist, 60000);
    }
    return () => {
      if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
    };
  }, [mediaContent, playlistIndex, playlist]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || mediaContent?.type !== "video") return;
    let done = false,
      stallTimer = null;
    const clearStall = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };
    const onTime = () => {
      try {
        if (!isFinite(v.duration) || v.duration === 0) return;
        if (v.currentTime >= v.duration - 0.1 && !done) {
          done = true;
          advancePlaylist();
        }
      } catch {}
    };
    const scheduleStall = () => {
      if (done || stallTimer) return;
      stallTimer = setTimeout(() => {
        if (!done) {
          done = true;
          advancePlaylist();
        }
      }, 5000);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("waiting", scheduleStall);
    v.addEventListener("stalled", scheduleStall);
    v.addEventListener("playing", clearStall);
    v.addEventListener("progress", clearStall);
    return () => {
      try {
        clearStall();
        v.removeEventListener("timeupdate", onTime);
        v.removeEventListener("waiting", scheduleStall);
        v.removeEventListener("stalled", scheduleStall);
        v.removeEventListener("playing", clearStall);
        v.removeEventListener("progress", clearStall);
      } catch {}
    };
  }, [mediaContent?.url, playlistIndex]);

  useEffect(() => {
    if (mediaContent?.type !== "video") return;
    const v = videoRef.current;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const ready = v?.readyState || 0;
        const canPlay = ready >= 2 && !v?.paused;
        if (!canPlay) advancePlaylist();
      } catch {
        advancePlaylist();
      }
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mediaContent?.url, reloadNonce, playlistIndex]);

  // ---- News ticker ----
  const loadNewsTicker = async () => {
    try {
      const newsData = await tvDisplayAPI.getNews();
      if (newsData && newsData.length) {
        const news = newsData[0];
        const text = news.title || news.content || "";
        setTicker(text);
        try {
          window.localStorage.setItem("last_news", text);
        } catch {}
      } else {
        setTicker("");
      }
    } catch {
      let cached = "";
      try {
        cached = window.localStorage.getItem("last_news") || "";
      } catch {}
      setTicker(cached);
    }
  };

  // ---- Socket.io (media + positions) ----
  useEffect(() => {
    const backendUrl = BACKEND_URL;
    socketRef.current = io(backendUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current.on("connect", () => {
      try {
        const payload = { busNumber: selectedBusNumber, depot: selectedDepot };
        socketRef.current.emit("subscribe", payload);
        socketRef.current.emit("join", payload);
        socketRef.current.emit("tv:register", payload);
        if (selectedBusNumber)
          socketRef.current.emit("join", { busNumber: selectedBusNumber });
        if (selectedDepot)
          socketRef.current.emit("join", { depot: selectedDepot });
      } catch {}
    });

    const onMediaUpdate = (data) => {
      if (
        data?.busNumber &&
        selectedBusNumber &&
        data.busNumber !== selectedBusNumber
      )
        return;
      if (data?.busId && busData && data.busId !== busData.id) return;

      setPlaylist([]);
      setMediaContent(null);
      setPlaylistIndex(0);
      try {
        const currentUrls = Array.isArray(playlist)
          ? playlist.map((i) => i?.url).filter(Boolean)
          : [];
        if (currentUrls.length) purgeCache(currentUrls);
      } catch {}

      setTimeout(() => {
        loadMediaContent();
      }, 500);
      try {
        let n = 3;
        const interval = setInterval(() => {
          if (--n <= 0) {
            clearInterval(interval);
            return;
          }
          loadMediaContent();
        }, 5000);
      } catch {}
    };

    socketRef.current.on("media:update", onMediaUpdate);
    socketRef.current.on("media:refresh", onMediaUpdate);
    socketRef.current.on("playlist:update", onMediaUpdate);

    socketRef.current.on("news:broadcast", (payload) => {
      const targets = payload?.targets || {};
      const deviceIds = Array.isArray(targets.deviceIds)
        ? targets.deviceIds
        : [];
      const depots = Array.isArray(targets.depots) ? targets.depots : [];
      const matchesDevice =
        deviceIds.length === 0 ||
        (selectedBusNumber && deviceIds.includes(selectedBusNumber));
      const matchesDepot =
        depots.length === 0 ||
        (selectedDepot && depots.includes(selectedDepot));
      if (matchesDevice && matchesDepot) {
        const text = payload?.title || payload?.content || "";
        setTicker(text);
        try {
          window.localStorage.setItem("last_news", text);
        } catch {}
      }
    });

    const handlePosition = (data) => {
      if (!data) return;
      const lat = Number(
        data.lat ?? data.latitude ?? data.lat_gps ?? (data.geo && data.geo.lat)
      );
      const lng = Number(
        data.lng ??
          data.longitude ??
          data.long_gps ??
          (data.geo && data.geo.lng)
      );
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const pos = { lat, lng, ts: Date.now() };
      lastLivePositionRef.current = pos;
      setCurrentLocation(pos);
    };

    socketRef.current.on("position", handlePosition);
    socketRef.current.on("location", handlePosition);
    socketRef.current.on("device:location", handlePosition);
    socketRef.current.on("vehicle:position", handlePosition);

    // Periodically emit our current location to persist in DB
    let heartbeat = null;
    const emitNow = () => {
      try {
        if (!socketRef.current || !selectedBusNumber) return;
        const pos = lastLivePositionRef.current || effectiveCurrentLocation;
        if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
        socketRef.current.emit('gps:update', { deviceId: selectedBusNumber, lat: pos.lat, lng: pos.lng });
      } catch {}
    };
    // Start 10s heartbeat
    heartbeat = setInterval(emitNow, 10000);

    return () => {
      try {
        socketRef.current?.off("position", handlePosition);
        socketRef.current?.off("location", handlePosition);
        socketRef.current?.off("device:location", handlePosition);
        socketRef.current?.off("vehicle:position", handlePosition);
        socketRef.current?.off("media:update", onMediaUpdate);
        socketRef.current?.off("media:refresh", onMediaUpdate);
        socketRef.current?.off("playlist:update", onMediaUpdate);
      } catch {}
      if (heartbeat) clearInterval(heartbeat);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusNumber, selectedDepot]);

  // Emit immediately whenever our effective location changes
  useEffect(() => {
    try {
      if (!socketRef.current || !selectedBusNumber) return;
      if (!effectiveCurrentLocation) return;
      const { lat, lng } = effectiveCurrentLocation;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      socketRef.current.emit('gps:update', { deviceId: selectedBusNumber, lat, lng });
    } catch {}
  }, [effectiveCurrentLocation?.lat, effectiveCurrentLocation?.lng, selectedBusNumber]);

  // ---- Start up ----
  useEffect(() => {
    loadBusData();
    loadMediaContent();
    loadNewsTicker();

    try {
      const prev = JSON.parse(
        window.localStorage.getItem("offline_playlist") || "[]"
      );
      if (Array.isArray(prev) && prev.length) {
        ensurePlaylistCached(prev);
      }
    } catch {}

    timerRef.current = setInterval(() => {
      loadBusData();
      loadNewsTicker();
    }, 60000);

    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusNumber]);

  return (
    <div className="display-container">
      <div className="main-content">
        {/* Left: Media */}
        <div className="media-panel">
          {mediaContent &&
            (mediaContent.type === "video" ? (
              <video
                key={reloadNonce + (mediaContent?.url || "")}
                src={mediaContent.url}
                className="media-content"
                autoPlay
                muted
                playsInline
                preload="metadata"
                controls={false}
                crossOrigin="anonymous"
                ref={videoRef}
                onEnded={advancePlaylist}
                onError={advancePlaylist}
                onLoadedMetadata={(e) => {
                  try {
                    e.currentTarget.currentTime = 0;
                  } catch {}
                }}
                onLoadedData={(e) => {
                  try {
                    const p = e.currentTarget.play();
                    if (p && typeof p.then === "function")
                      p.catch(() => advancePlaylist());
                  } catch {
                    advancePlaylist();
                  }
                }}
                onCanPlay={(e) => {
                  try {
                    const p = e.currentTarget.play();
                    if (p && typeof p.then === "function")
                      p.catch(() => advancePlaylist());
                  } catch {
                    advancePlaylist();
                  }
                }}
              />
            ) : (
              <img
                src={mediaContent?.url}
                className="media-content image"
                alt=""
                crossOrigin="anonymous"
                onError={advancePlaylist}
              />
            ))}
        </div>

        {/* Right: Info */}
        <div className="info-panel" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          <div className="bus-number-section">
            <div className="bus-label">BUS NUMBER</div>
            <div className="bus-number">{selectedBusNumber || "Not Set"}</div>
            {selectedDepot && (
              <div className="depot-info">Depot: {selectedDepot}</div>
            )}
          </div>

          <div className="map-section" style={{ flex: "1 1 auto", minHeight: 0, display: "flex" }}>
            <div className="map-container" style={{ width: "100%", height: "100%", position: "relative", minHeight: 0, flex: 1 }}>
              {/* Global compact bus number badge on the map */}
              <div className="bus-badge">{selectedBusNumber || ''}</div>
              <MapboxMap
                startLocation={startLocation}
                endLocation={endLocation}
                currentLocation={effectiveCurrentLocation}
                stops={[]} // no default stops injected
                busNumber={selectedBusNumber}
                routeKey={routeKey} // Pass routeKey as prop to trigger rebuild
                onNextStop={(name) => setNextStop(name || '')}
                onFinalDestinationChange={(name) => setFinalDestination(name || '')}
                onRouteFlipped={async () => {
                  // Reload bus data after route flip to get updated start/end from database
                  console.log('[Display] Route flipped, reloading bus data from database');
                  try {
                    await loadBusData();
                    // Note: loadBusData will update startLocation/endLocation and increment routeKey
                    // The routeKey prop change will trigger route rebuild in MapboxMap
                    console.log('[Display] Bus data reloaded after flip - route will rebuild');
                  } catch (error) {
                    console.error('[Display] Error reloading bus data after flip', error);
                    throw error; // Re-throw so MapboxMap knows if reload failed
                  }
                }}
                follow
              />
            </div>
          </div>

          <div className="stop-section next-stop">
            <div className="stop-label">NEXT STOP</div>
            <div className="stop-name">{nextStop || ""}</div>
          </div>

          <div className="stop-section final-destination">
            <div className="stop-label">FINAL DESTINATION</div>
            <div className="stop-name">{finalDestination || ""}</div>
          </div>
        </div>
      </div>

      <div className="ticker-bar">
        <div className="ticker-track" ref={tickerTrackRef}>
          <span className="ticker-item">{ticker}</span>
          <span className="ticker-item" aria-hidden="true">{ticker}</span>
        </div>
      </div>
    </div>
  );
};

export default Display;
