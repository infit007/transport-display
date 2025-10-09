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
  const initialVideo = (
    searchParams.get("video") || import.meta.env.VITE_PROMO_VIDEO_URL || "https://vjs.zencdn.net/v/oceans.mp4"
  ).trim();

  const [news, setNews] = useState<string>(initialNews);
  const [position, setPosition] = useState<{ lat: number; lng: number }>({ lat: initialLat, lng: initialLng });
  const [mapZoom] = useState<number>(initialZoom);
  const [nextStop, setNextStop] = useState<string>(initialNext);
  const [videoUrl] = useState<string>(initialVideo);
  const [destination, setDestination] = useState<string>(initialDestination);
  const [trail, setTrail] = useState<Array<[number, number]>>([[initialLat, initialLng]]);
  const [plannedRoute, setPlannedRoute] = useState<Array<[number, number]>>([]);
  const [startPoint, setStartPoint] = useState<string>("");
  const [endPoint, setEndPoint] = useState<string>("");
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  // Detect YouTube links and build an embeddable URL
  const isYouTube = useMemo(() => !!ytIdParam || /(?:youtu\.be\/|youtube\.com\/)/i.test(videoUrl.trim()), [ytIdParam, videoUrl]);
  const youTubeEmbedUrl = useMemo(() => {
    if (!isYouTube) return "";
    try {
      const id = ytIdParam
        ? ytIdParam
        : (() => {
            const url = new URL(videoUrl.trim());
            if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
            return url.searchParams.get("v") || "";
          })();
      if (!id) return "";
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0`;
    } catch {
      return "";
    }
  }, [isYouTube, videoUrl, ytIdParam]);

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
    // Socket wiring
    const endpoint = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
    socketRef.current = io(endpoint, { transports: ["websocket"], autoConnect: true });
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
  }, [initialNews]);

  // Subscribe to bus row changes and hydrate from Supabase
  useEffect(() => {
    const loadBus = async () => {
      if (!deviceId) return;
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await (supabase as any)
        .from("buses")
        .select("bus_number, start_point, end_point, route_name, driver_name, conductor_name")
        .eq("bus_number", deviceId)
        .maybeSingle();
      if (data?.start_point) setStartPoint(data.start_point);
      if (data?.end_point) setEndPoint(data.end_point);

      // live subscription
      const channel = (supabase as any)
        .channel("bus-" + deviceId)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "buses", filter: `bus_number=eq.${deviceId}` },
          (payload: any) => {
            const row = payload.new || {};
            if (row.start_point) setStartPoint(row.start_point);
            if (row.end_point) setEndPoint(row.end_point);
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

  useEffect(() => {
    // Video.js player (skip when using YouTube iframe)
    if (isYouTube) return;
    if (!videoRef.current) return;
    if (playerRef.current) return; // once
    playerRef.current = videojs(videoRef.current, {
      autoplay: true,
      controls: false,
      preload: "auto",
      loop: true,
      sources: [
        {
          src: videoUrl,
          type: "video/mp4",
        },
      ],
    });
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, [isYouTube, videoUrl]);

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
              <video ref={videoRef} className="video-js vjs-big-play-centered w-full h-full object-cover" />
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


