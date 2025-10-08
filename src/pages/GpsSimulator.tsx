import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { io, Socket } from "socket.io-client";

const route: Array<{ lat: number; lng: number; next?: string }> = [
  { lat: 30.3165, lng: 78.0322, next: "Haridwar" }, // Dehradun
  { lat: 30.2817, lng: 78.0090, next: "Doiwala" },
  { lat: 29.9457, lng: 78.1642, next: "Haridwar" }, // Haridwar
  { lat: 29.8042, lng: 77.8800, next: "Roorkee" },
  { lat: 29.4724, lng: 77.7085, next: "Muzaffarnagar" },
  { lat: 29.0588, lng: 77.0120, next: "Sonipat" },
  { lat: 28.6139, lng: 77.2090, next: "New Delhi" }, // New Delhi
];

const GpsSimulator = () => {
  const [running, setRunning] = useState(false);
  const [speedMs, setSpeedMs] = useState(20); // meters per second (approx)
  const [deviceId, setDeviceId] = useState("BUS-001");
  const segmentIdx = useRef(0);
  const tParam = useRef(0); // 0..1 along current segment
  const timer = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const endpoint = useMemo(() => import.meta.env.VITE_BACKEND_URL || "http://localhost:4000", []);

  useEffect(() => {
    socketRef.current = io(endpoint, { transports: ["websocket"], autoConnect: true });
    return () => {
      socketRef.current?.disconnect();
    };
  }, [endpoint]);

  const emitPoint = (lat: number, lng: number, nextStop?: string) => {
    socketRef.current?.emit("gps:update", { deviceId, lat, lng, nextStop });
  };

  const step = () => {
    const a = route[segmentIdx.current];
    const b = route[segmentIdx.current + 1];
    if (!b) {
      setRunning(false);
      return;
    }
    // linear interpolate ~ rough meters by lat/lng (ok for demo)
    const lat = a.lat + (b.lat - a.lat) * tParam.current;
    const lng = a.lng + (b.lng - a.lng) * tParam.current;
    emitPoint(lat, lng, b.next);

    // advance t by a simple factor based on speed
    const dist = Math.hypot((b.lat - a.lat) * 111_000, (b.lng - a.lng) * 111_000 * Math.cos((lat * Math.PI) / 180));
    const dt = 1000; // ms tick
    const advance = (speedMs * (dt / 1000)) / Math.max(dist, 1);
    tParam.current += advance;
    if (tParam.current >= 1) {
      segmentIdx.current += 1;
      tParam.current = 0;
    }
  };

  const start = () => {
    if (running) return;
    setRunning(true);
    segmentIdx.current = 0;
    tParam.current = 0;
    timer.current = window.setInterval(step, 1000);
  };

  const stop = () => {
    setRunning(false);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => () => stop(), []);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-xl font-semibold">GPS Route Simulator</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm">Device ID</label>
            <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Speed (m/s)</label>
            <Input value={String(speedMs)} onChange={(e) => setSpeedMs(Number(e.target.value) || 1)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={start} disabled={running}>Start</Button>
          <Button onClick={stop} variant="secondary" disabled={!running}>Stop</Button>
        </div>
        <div className="text-sm text-muted-foreground">
          Emits gps:update from Dehradun → Haridwar → New Delhi every second. Open a Display with <code>?deviceId=BUS-001</code> to filter.
        </div>
      </div>
    </DashboardLayout>
  );
};

export default GpsSimulator;


