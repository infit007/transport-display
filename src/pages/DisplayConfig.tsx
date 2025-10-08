import { useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const DisplayConfig = () => {
  const [video, setVideo] = useState("");
  const [yt, setYt] = useState("");
  const [lat, setLat] = useState("30.3165");
  const [lng, setLng] = useState("78.0322");
  const [zoom, setZoom] = useState("13");
  const [nextStop, setNextStop] = useState("Haridwar");
  const [destination, setDestination] = useState("New Delhi");
  const [news, setNews] = useState("Welcome to FleetSignage");
  const [showRoute, setShowRoute] = useState(true);
  const [showTrail, setShowTrail] = useState(true);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (video.trim()) params.set("video", video.trim());
    if (yt.trim()) params.set("yt", yt.trim());
    if (lat.trim()) params.set("lat", lat.trim());
    if (lng.trim()) params.set("lng", lng.trim());
    if (zoom.trim()) params.set("zoom", zoom.trim());
    if (nextStop.trim()) params.set("nextStop", nextStop.trim());
    if (destination.trim()) params.set("destination", destination.trim());
    if (news.trim()) params.set("news", news.trim());
    if (showRoute) params.set("showRoute", "1");
    if (showTrail) params.set("showTrail", "1");
    const qs = params.toString();
    return `/display${qs ? `?${qs}` : ""}`;
  }, [video, yt, lat, lng, zoom, nextStop, destination, news, showRoute, showTrail]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
    } catch {
      // noop
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Display Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm">YouTube ID (yt)</label>
                <Input value={yt} onChange={(e) => setYt(e.target.value)} placeholder="u5s8EG_7PW0" />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Video URL (mp4)</label>
                <Input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://.../video.mp4" />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Latitude</label>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Longitude</label>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Zoom</label>
                <Input value={zoom} onChange={(e) => setZoom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Next Stop</label>
                <Input value={nextStop} onChange={(e) => setNextStop(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Final Destination</label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm">News Ticker</label>
                <Input value={news} onChange={(e) => setNews(e.target.value)} />
              </div>
              <div className="flex items-center justify-between md:col-span-1">
                <label className="text-sm">Show Planned Route</label>
                <Switch checked={showRoute} onCheckedChange={setShowRoute} />
              </div>
              <div className="flex items-center justify-between md:col-span-1">
                <label className="text-sm">Show Live Trail</label>
                <Switch checked={showTrail} onCheckedChange={setShowTrail} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input readOnly value={url} className="font-mono" />
              <Button onClick={copy} variant="secondary">Copy full URL</Button>
              <a href={url} target="_blank" rel="noreferrer">
                <Button>Open Display</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DisplayConfig;


