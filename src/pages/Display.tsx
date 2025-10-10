import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import KioskLayout from "@/components/layout/KioskLayout";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Default Leaflet marker fix for bundlers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type GpsPayload = {
  lat: number;
  lng: number;
  speedKph?: number;
  nextStop?: string;
};

const Display = () => {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const presetId = searchParams.get("presetId");
  const deviceId = searchParams.get("deviceId");
  const initialLat = Number(searchParams.get("lat") || 1.2921);
  const initialLng = Number(searchParams.get("lng") || 36.8219);
  const initialZoom = Number(searchParams.get("zoom") || 14);
  const initialNews = searchParams.get("news") || "Welcome to FleetSignage";
  const initialNext = searchParams.get("nextStop") || "Central Station";
  const initialDestination = searchParams.get("destination") || "Terminal";
  const showRoute = ["1","true","yes"].includes((searchParams.get("showRoute") || "").toLowerCase());
  const showTrail = ["1","true","yes"].includes((searchParams.get("showTrail") || "").toLowerCase());
  const useOsrm = ["1","true","yes"].includes((searchParams.get("osrm") || "").toLowerCase());
  const ytIdParam = searchParams.get("yt");
  const noSocket = ["1","true","yes"].includes((searchParams.get("nosocket") || "").toLowerCase());
  // Resolve initial video URL from query/env with safety checks
  const resolveInitialVideo = () => {
    const qp = (searchParams.get("video") || "").trim();
    if (qp) return qp;
    const envUrl = (import.meta.env.VITE_PROMO_VIDEO_URL || "").trim();
    // Ignore placeholder/non-URL values
    if (envUrl && /^https?:\/\//i.test(envUrl) && !/your-video-url\.mp4/i.test(envUrl)) return envUrl;
    return "https://vjs.zencdn.net/v/oceans.mp4";
  };
  const initialVideo = resolveInitialVideo();

  const [news, setNews] = useState<string>(initialNews);
  const [position, setPosition] = useState<{ lat: number; lng: number }>({ lat: initialLat, lng: initialLng });
  const [mapZoom] = useState<number>(initialZoom);
  const [nextStop, setNextStop] = useState<string>(initialNext);
  const [videoUrl, setVideoUrl] = useState<string>(initialVideo);
  const [destination, setDestination] = useState<string>(initialDestination);
  const [trail, setTrail] = useState<Array<[number, number]>>([[initialLat, initialLng]]);
  const [plannedRoute, setPlannedRoute] = useState<Array<[number, number]>>([]);
  const [startPoint, setStartPoint] = useState<string>("");
  const [endPoint, setEndPoint] = useState<string>("");
  const [mediaFromLibrary, setMediaFromLibrary] = useState<{url: string, type: 'file' | 'link'} | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  // Detect YouTube links and build an embeddable URL
  const currentVideoUrl = mediaFromLibrary?.url || videoUrl;
  
  // Debug logging
  console.log("Current video URL:", currentVideoUrl);
  console.log("Media from library:", mediaFromLibrary);
  console.log("Original video URL:", videoUrl);
  
  const isYouTube = useMemo(() => {
    if (mediaFromLibrary?.type === 'link') {
      return /(?:youtu\.be\/|youtube\.com\/)/i.test(mediaFromLibrary.url);
    }
    return !!ytIdParam || /(?:youtu\.be\/|youtube\.com\/)/i.test(videoUrl.trim());
  }, [ytIdParam, videoUrl, mediaFromLibrary]);
  
  const youTubeEmbedUrl = useMemo(() => {
    if (!isYouTube) return "";
    try {
      const id = ytIdParam
        ? ytIdParam
        : (() => {
            const url = new URL(currentVideoUrl.trim());
            if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
            return url.searchParams.get("v") || "";
          })();
      if (!id) return "";
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0`;
    } catch {
      return "";
    }
  }, [isYouTube, currentVideoUrl, ytIdParam]);

  useEffect(() => {
    // If presetId is provided, fetch preset from Supabase and override local state
    const loadPreset = async () => {
      if (!presetId) return;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await (supabase as any).from("display_presets").select("*").eq("id", presetId).maybeSingle();
        if (!data) return;
        if (typeof data.lat === "number" && typeof data.lng === "number") {
          setPosition({ lat: data.lat, lng: data.lng });
        }
        if (data.next_stop) setNextStop(data.next_stop);
        if (data.destination) setDestination(data.destination);
        if (data.news) setNews(data.news);
        if (data.youtube_id) {
          const url = new URL(window.location.href);
          url.searchParams.set("yt", data.youtube_id);
          window.history.replaceState({}, "", url.toString());
        } else if (data.video_url) {
          const url = new URL(window.location.href);
          url.searchParams.set("video", data.video_url);
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        // ignore
      }
    };
    loadPreset();
  }, [presetId]);

  useEffect(() => {
    // Fetch media from media library based on deviceId (bus_number)
    const loadMediaFromLibrary = async () => {
      if (!deviceId) return;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const busNumber = deviceId;
        console.log("Looking for bus with number:", busNumber);
        
        // First get the bus ID from bus_number
        const { data: busData, error: busError } = await (supabase as any)
          .from("buses")
          .select("id, bus_number")
          .eq("bus_number", busNumber)
          .maybeSingle();

        if (busError) {
          console.log("Error fetching bus:", busError.message);
          return;
        }

        if (!busData) {
          console.log("No bus found with number:", busNumber);
          return;
        }

        console.log("Found bus:", busData);

        const { data, error } = await (supabase as any)
          .from("media_library")
          .select("url, type")
          .eq("bus_id", busData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.log("Media library not available or no media found:", error.message);
          return;
        }

        if (data) {
          console.log("Found media from library:", data);
          setMediaFromLibrary({ url: data.url, type: data.type });
          // Update video URL to use the media from library
          setVideoUrl(data.url);
        } else {
          console.log("No media found for bus:", busData.bus_number);
          // Keep using the default video URL from URL parameters
        }
      } catch (error) {
        console.log("Error fetching media from library:", error);
        // ignore errors - fallback to URL parameters
      }
    };
    loadMediaFromLibrary();
  }, [deviceId]);

  useEffect(() => {
    if (noSocket) return;
    // Socket wiring
    const endpoint = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
    // Do NOT force websocket; allow polling fallback so proxies/cold starts work
    socketRef.current = io(endpoint, {
      path: "/socket.io",
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    // Tolerate backend being asleep/unavailable without breaking UI
    socketRef.current.on("connect_error", (err: any) => {
      console.warn("Socket connect_error", err?.message || err);
    });
    socketRef.current.on("error", (err: any) => {
      console.warn("Socket error", err?.message || err);
    });

    socketRef.current.on("news:broadcast", (payload: { title?: string; content?: string }) => {
      setNews(payload?.title || payload?.content || initialNews);
    });
    const targetDeviceId = new URLSearchParams(window.location.search).get("deviceId");
    socketRef.current.on("gps:position", (payload: GpsPayload & { deviceId?: string }) => {
      if (targetDeviceId && payload?.deviceId && payload.deviceId !== targetDeviceId) return;
      if (typeof payload?.lat === "number" && typeof payload?.lng === "number") {
        setPosition({ lat: payload.lat, lng: payload.lng });
        if (showTrail) {
          setTrail((prev: Array<[number, number]>) => {
            const next: Array<[number, number]> = [...prev, [payload.lat, payload.lng]] as Array<[number, number]>;
            return next.length > 500 ? (next.slice(next.length - 500) as Array<[number, number]>) : next;
          });
        }
      }
      if (payload?.nextStop) setNextStop(payload.nextStop);
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, [initialNews, noSocket]);

  // Subscribe to bus row changes and hydrate from Supabase
  useEffect(() => {
    const loadBus = async () => {
      if (!deviceId) return;
      const busNumber = deviceId;
      console.log("Loading bus data for:", busNumber);
      
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase as any)
        .from("buses")
        .select("bus_number, start_point, end_point, route_name, driver_name, conductor_name, gps_latitude, gps_longitude")
        .eq("bus_number", busNumber)
        .maybeSingle();
        
      if (error) {
        console.log("Error loading bus:", error.message);
        return;
      }
        
      if (data) {
        console.log("Loaded bus data:", data);
        if (data.start_point) setStartPoint(data.start_point);
        if (data.end_point) setEndPoint(data.end_point);
        if (data.start_point) setNextStop(data.start_point);
        if (data.end_point) setDestination(data.end_point);
        
        // Update position if GPS coordinates are available
        if (data.gps_latitude && data.gps_longitude) {
          setPosition({ lat: data.gps_latitude, lng: data.gps_longitude });
        }
      } else {
        console.log("No bus found with number:", busNumber);
      }

      // live subscription
      const channel = (supabase as any)
        .channel("bus-" + busNumber)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "buses", filter: `bus_number=eq.${busNumber}` },
          (payload: any) => {
            const row = payload.new || {};
            if (row.start_point) setStartPoint(row.start_point);
            if (row.end_point) setEndPoint(row.end_point);
            if (row.start_point) setNextStop(row.start_point);
            if (row.end_point) setDestination(row.end_point);
            if (row.gps_latitude && row.gps_longitude) {
              setPosition({ lat: row.gps_latitude, lng: row.gps_longitude });
            }
          }
        )
        .subscribe();

      return () => {
        (supabase as any).removeChannel?.(channel);
      };
    };
    loadBus();
  }, [deviceId]);

  // Geocode and route using OSRM when requested
  useEffect(() => {
    const computeRoute = async () => {
      if (!useOsrm) return;
      const s = startPoint || nextStop || "Dehradun ISBT";
      const e = endPoint || destination || "New Delhi";
      try {
        const geocode = async (q: string) => {
          const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
          const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
          const arr = await resp.json();
          if (!arr?.length) return null;
          return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
        };
        const a = await geocode(s);
        const b = await geocode(e);
        if (!a || !b) return;
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
        const osrmResp = await fetch(osrmUrl);
        const osrm = await osrmResp.json();
        const coords: Array<[number, number]> = osrm?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [c[1], c[0]]) || [];
        setPlannedRoute(coords);
      } catch {
        // ignore routing errors
      }
    };
    computeRoute();
  }, [useOsrm, startPoint, endPoint, nextStop, destination]);

  // Map follow component
  const ChangeView = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      map.setView(center, mapZoom, { animate: true });
    }, [center]);
    return null;
  };

  // Infer a reasonable MIME type from URL extension
  const inferMimeType = (url: string): string => {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      if (pathname.endsWith('.mp4')) return 'video/mp4';
      if (pathname.endsWith('.webm')) return 'video/webm';
      if (pathname.endsWith('.ogg') || pathname.endsWith('.ogv')) return 'video/ogg';
      if (pathname.endsWith('.mov')) return 'video/quicktime';
      if (pathname.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
      return 'video/mp4';
    } catch {
      return 'video/mp4';
    }
  };

  useEffect(() => {
    // Video.js player (skip when using YouTube iframe)
    if (isYouTube) return;
    if (!currentVideoUrl) return; // Wait for video URL to be set

    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      if (!videoRef.current) return;

      // Dispose existing player if it exists
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }

      console.log("Initializing video player with URL:", currentVideoUrl);

      playerRef.current = videojs(videoRef.current, {
        // Autoplay on TV/Chromium requires muted + playsinline
        autoplay: 'muted',
        muted: true,
        controls: false,
        preload: "auto",
        loop: true,
        playsinline: true as any,
        html5: {
          vhs: { overrideNative: true },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
          nativeControlsForTouch: false,
        },
        sources: [
          {
            src: currentVideoUrl,
            type: inferMimeType(currentVideoUrl),
          },
        ],
      });

      // Add error handling
      playerRef.current.on('error', (error: any) => {
        console.error('Video player error:', error);
      });
    };

    // Defer one tick to ensure the element is in the DOM
    const timer = window.setTimeout(init, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [isYouTube, currentVideoUrl]);

  return (
    <KioskLayout>
      <div className="h-screen w-full flex flex-col gap-3 p-3">
        <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
          {/* Video (2/3 width) */}
          <div className="col-span-2 bg-black rounded-xl overflow-hidden shadow-2xl">
            {isYouTube ? (
              <iframe
                title="display-video"
                src={youTubeEmbedUrl}
                className="w-full h-full"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
                frameBorder={0}
              />
            ) : (
              <video 
                key={currentVideoUrl}
                ref={videoRef} 
                className="video-js vjs-big-play-centered w-full h-full object-cover"
                // Important: hint autoplay on browsers
                muted
                playsInline
                preload="auto"
                crossOrigin="anonymous"
              />
            )}
          </div>

          {/* Map + next stop (1/3 width) */}
          <div className="col-span-1 grid grid-rows-6 gap-3">
            <div className="row-span-4 rounded-xl overflow-hidden border border-border bg-card">
              <MapContainer {...({ center: [position.lat, position.lng] as [number, number], zoom: mapZoom, className: "w-full h-full" } as any)}>
                <ChangeView center={[position.lat, position.lng]} />
                <TileLayer {...({ url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap contributors" } as any)} />
                {(showRoute || useOsrm) && plannedRoute.length > 1 && (
                  <Polyline positions={plannedRoute} pathOptions={{ color: "#3b82f6", weight: 5 }} />
                )}
                {showTrail && trail.length > 1 && (
                  <Polyline positions={trail} pathOptions={{ color: "#22c55e", weight: 4, opacity: 0.8 }} />
                )}
                <Marker position={[position.lat, position.lng]}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">Current Location</div>
                      <div className="text-sm">Lat: {position.lat.toFixed(4)}, Lng: {position.lng.toFixed(4)}</div>
                      <div className="text-sm">Next Stop: {nextStop}</div>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <div className="row-span-1 rounded-xl border border-border bg-card p-4 flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm text-muted-foreground uppercase tracking-wider">Next Stop</div>
                <div className="text-3xl font-bold mt-1">{nextStop}</div>
              </div>
            </div>
            <div className="row-span-1 rounded-xl border border-border bg-card p-4 flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm text-muted-foreground uppercase tracking-wider">Final Destination</div>
                <div className="text-2xl font-bold mt-1">{destination}</div>
              </div>
            </div>
          </div>
        </div>

        {/* News ticker bottom */}
        <div className="w-full py-3 px-4 rounded-xl bg-card border border-border text-xl">
          <marquee>{news}</marquee>
        </div>
      </div>
    </KioskLayout>
  );
};

export default Display;


