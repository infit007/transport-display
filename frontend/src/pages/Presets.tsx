import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdmin } from "@/hooks/use-admin";

type Preset = {
  id: string;
  name: string;
  video_url: string | null;
  youtube_id: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  next_stop: string | null;
  destination: string | null;
  news: string | null;
  show_route: boolean | null;
  show_trail: boolean | null;
  device_id: string | null;
};

const Presets = () => {
  const { isAdmin } = useAdmin();
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<Partial<Preset>>({
    name: "Default",
    lat: 30.3165,
    lng: 78.0322,
    zoom: 13,
    next_stop: "Haridwar",
    destination: "New Delhi",
    news: "Welcome to FleetSignage",
    show_route: true,
    show_trail: true,
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("display_presets").select("*").order("created_at", { ascending: false });
      setItems((data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  const create = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.from("display_presets").insert({
      name: form.name,
      video_url: form.video_url,
      youtube_id: form.youtube_id,
      lat: form.lat,
      lng: form.lng,
      zoom: form.zoom,
      next_stop: form.next_stop,
      destination: form.destination,
      news: form.news,
      show_route: form.show_route,
      show_trail: form.show_trail,
      device_id: form.device_id,
    }).select("*").single();
    if (!error && data) setItems((prev) => [data as any, ...prev]);
  };

  const del = async (id: string) => {
    if (!isAdmin) return;
    await supabase.from("display_presets").delete().eq("id", id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const linkFor = (p: Preset) => {
    const params = new URLSearchParams();
    if (p.youtube_id) params.set("yt", p.youtube_id);
    if (p.video_url) params.set("video", p.video_url);
    if (p.lat != null && p.lng != null) { params.set("lat", String(p.lat)); params.set("lng", String(p.lng)); }
    if (p.zoom != null) params.set("zoom", String(p.zoom));
    if (p.next_stop) params.set("nextStop", p.next_stop);
    if (p.destination) params.set("destination", p.destination);
    if (p.news) params.set("news", p.news);
    if (p.show_route) params.set("showRoute", "1");
    if (p.show_trail) params.set("showTrail", "1");
    if (p.device_id) params.set("deviceId", p.device_id);
    return `/display?${params.toString()}`;
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Display Presets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="YouTube ID" value={form.youtube_id || ""} onChange={(e) => setForm({ ...form, youtube_id: e.target.value })} />
              <Input placeholder="Video URL" value={form.video_url || ""} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
              <Input placeholder="Lat" value={String(form.lat ?? "")} onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })} />
              <Input placeholder="Lng" value={String(form.lng ?? "")} onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })} />
              <Input placeholder="Zoom" value={String(form.zoom ?? "")} onChange={(e) => setForm({ ...form, zoom: Number(e.target.value) })} />
              <Input placeholder="Next Stop" value={form.next_stop || ""} onChange={(e) => setForm({ ...form, next_stop: e.target.value })} />
              <Input placeholder="Destination" value={form.destination || ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              <Input placeholder="News" value={form.news || ""} onChange={(e) => setForm({ ...form, news: e.target.value })} />
            </div>
            <Button onClick={create} disabled={!isAdmin}>Save Preset</Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{p.name}</span>
                  <div className="flex gap-2">
                    <a href={linkFor(p)} target="_blank" rel="noreferrer"><Button>Open</Button></a>
                    {isAdmin && <Button variant="secondary" onClick={() => navigator.clipboard.writeText(window.location.origin + linkFor(p))}>Copy URL</Button>}
                    {isAdmin && <Button variant="destructive" onClick={() => del(p.id)}>Delete</Button>}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">{p.news || ""}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Presets;


