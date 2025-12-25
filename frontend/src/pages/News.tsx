import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { io, Socket } from "socket.io-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NewsRow = {
  id: string;
  title: string;
  content: string;
  priority: number;
  is_active: boolean;
  created_at: string;
};

const News = () => {
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [items, setItems] = useState<NewsRow[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const backendUrl = useMemo(() => import.meta.env.VITE_BACKEND_URL || "https://transport-display.onrender.com", []);
  const uttarakhandDepots = [
    "Dehradun Depot","Haridwar Depot","Rishikesh Depot","Roorkee Depot","Haldwani Depot","Nainital Depot","Almora Depot","Ranikhet Depot","Pithoragarh Depot","Champawat Depot","Bageshwar Depot","Kausani Depot","Tanakpur Depot","Khatima Depot","Kashipur Depot","Rudrapur Depot","Sitarganj Depot","Jaspur Depot","Bazpur Depot","Mussoorie Depot","Vikasnagar Depot","Doiwala Depot","Pauri Depot","Kotdwar Depot","Srinagar (Garhwal) Depot","Devprayag Depot","Tehri Depot","New Tehri Depot","Uttarkashi Depot","Joshimath Depot","Gopeshwar (Chamoli) Depot","Rudraprayag Depot","Lansdowne Depot","Kichha Depot"
  ];
  const [targetDepot, setTargetDepot] = useState<string>("");
  const [targetBusNumber, setTargetBusNumber] = useState<string>("");
  const [buses, setBuses] = useState<{ id: string; bus_number: string; depo?: string }[]>([]);
  const [selectedBusIds, setSelectedBusIds] = useState<string[]>([]);
  const [mediaItems, setMediaItems] = useState<{ url: string; type: string; name?: string; bus_id?: string }[]>([]);
  const [selectedMediaIdx, setSelectedMediaIdx] = useState<number[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [assigning, setAssigning] = useState<boolean>(false);
  const [assignProgress, setAssignProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadingBusMedia, setLoadingBusMedia] = useState<boolean>(false);

  const loadNews = async () => {
    const { data, error } = await (supabase as any)
      .from("news_feeds")
      .select("id, title, content, priority, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems(data || []);
  };

  useEffect(() => {
    loadNews();
    // connect socket for push actions
    try {
      socketRef.current = io(backendUrl, { transports: ["websocket"], autoConnect: true });
    } catch {
      // ignore
    }
    // load initial lists
    fetch(`${backendUrl}/api/buses/public`).then(r => r.json()).then(setBuses).catch(() => {});
    fetch(`${backendUrl}/api/media/public`).then(r => r.json()).then((list) => setMediaItems(Array.isArray(list) ? list : [])).catch(() => {});
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const createNews = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: message,
      content: message,
      priority,
      is_active: isActive,
      target_depots: targetDepot ? [targetDepot] : [],
      target_device_ids: targetBusNumber ? [targetBusNumber] : [],
    } as any;
    const { error } = await (supabase as any).from("news_feeds").insert([payload]);
    if (error) return toast.error(error.message);
    toast.success("News created");
    setMessage("");
    setPriority(1);
    setIsActive(true);
    loadNews();
  };

  const toggleActive = async (id: string, value: boolean) => {
    const { error } = await (supabase as any).from("news_feeds").update({ is_active: value }).eq("id", id);
    if (error) return toast.error(error.message);
    loadNews();
  };

  const pushNow = async (row?: Partial<NewsRow>) => {
    const titleVal = (row?.title || message || "").trim();
    const contentVal = (row?.content || message || "").trim();
    if (!titleVal && !contentVal) return toast.error("Nothing to push. Provide a message.");

    // Save to DB first so it shows under Existing
    try {
      const { error } = await (supabase as any).from("news_feeds").insert([
        {
          title: titleVal,
          content: contentVal,
          priority,
          is_active: true,
          target_depots: targetDepot ? [targetDepot] : [],
          target_device_ids: targetBusNumber ? [targetBusNumber] : [],
        }
      ]);
      if (error) {
        // Still allow push even if save fails
        console.log("Save failed, pushing anyway:", error.message);
      } else {
        loadNews();
      }
    } catch (e) {
      // ignore save errors, proceed to push
    }

    if (!socketRef.current) return toast.error("Push channel not connected.");
    socketRef.current.emit("news:push", {
      title: titleVal,
      content: contentVal,
      targets: {
        deviceIds: targetBusNumber ? [targetBusNumber] : [],
        depots: targetDepot ? [targetDepot] : [],
      }
    });
    toast.success("Saved (if permitted) and pushed to displays");
  };

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name);
      form.append('type', 'file');
      const resp = await fetch(`${backendUrl}/api/media/upload`, { method: 'POST', body: form, credentials: 'include' });
      if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
      await fetch(`${backendUrl}/api/media/public`).then(r => r.json()).then((list) => setMediaItems(Array.isArray(list) ? list : []));
      toast.success('Uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const toggleBus = (id: string) => {
    setSelectedBusIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleMedia = (idx: number) => {
    setSelectedMediaIdx((prev) => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]);
  };

  const fetchBusCurrentlyStreamingMedia = async (busId: string) => {
    setLoadingBusMedia(true);
    try {
      const response = await fetch(`${backendUrl}/api/media/public/bus/${busId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch media for bus: ${response.status}`);
      }
      const busMedia = await response.json();
      
      if (Array.isArray(busMedia) && busMedia.length > 0) {
        // Find the indices of media items that match the currently streaming media
        const currentlyStreamingIndices: number[] = [];
        
        busMedia.forEach((streamingMedia: { url: string; type: string; name?: string }) => {
          const matchingIndex = mediaItems.findIndex(media => 
            media.url === streamingMedia.url && media.type === streamingMedia.type
          );
          if (matchingIndex !== -1) {
            currentlyStreamingIndices.push(matchingIndex);
          }
        });
        
        // Pre-check the currently streaming media items
        setSelectedMediaIdx(currentlyStreamingIndices);
        
        if (currentlyStreamingIndices.length > 0) {
          toast.success(`Found ${currentlyStreamingIndices.length} currently streaming media item(s) for this bus`);
        } else {
          toast.info("No currently streaming media found for this bus");
        }
      } else {
        toast.info("No currently streaming media found for this bus");
        setSelectedMediaIdx([]);
      }
    } catch (error: any) {
      console.error("Error fetching bus media:", error);
      toast.error(`Failed to fetch currently streaming media: ${error.message}`);
    } finally {
      setLoadingBusMedia(false);
    }
  };

  const handleBusClick = (busId: string) => {
    fetchBusCurrentlyStreamingMedia(busId);
  };

  const assignSelectedMediaToBuses = async () => {
    if (selectedBusIds.length === 0) return toast.error('Select at least one bus');
    const items = selectedMediaIdx.map((i) => mediaItems[i]).filter(Boolean).map((m) => ({ url: m.url, type: m.type, name: m.name }));
    if (items.length === 0) return toast.error('Select at least one media item');
    setAssigning(true);
    setAssignProgress({ done: 0, total: 1 });
    try {
      // Single call: backend clears once and inserts all items for all buses
      const resp = await fetch(`${backendUrl}/api/media/public/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busIds: selectedBusIds, items }),
      });
      if (!resp.ok) throw new Error(`Assign failed (${resp.status})`);
      setAssignProgress({ done: 1, total: 1 });
      toast.success('Media replaced on selected buses');
      try {
        // Ask TV clients to purge locally cached media for those buses so they pick up new content
        fetch(`${backendUrl}/api/media/public/notify-purge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ busIds: selectedBusIds })
        }).catch(() => {});
      } catch {}
    } catch (err: any) {
      toast.error(err.message || 'Assign failed');
    } finally {
      setAssigning(false);
      setAssignProgress(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Push media and news</h1>
          <p className="text-muted-foreground">Manage and push news and media to displays.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create News</CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => pushNow()}>Push now</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNews} className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-3">
                <Label>Message</Label>
                <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Text to display on screens" />
              </div>
              <div>
                <Label>Target Depot</Label>
                <Select value={targetDepot || "__ALL__"} onValueChange={(v) => setTargetDepot(v === "__ALL__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Depots" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All Depots</SelectItem>
                    {uttarakhandDepots.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Bus Number</Label>
                <Input value={targetBusNumber} onChange={(e) => setTargetBusNumber(e.target.value)} placeholder="e.g., UK-01-A-1001" />
              </div>
              <div>
                <Label>Priority</Label>
                <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
              </div>
              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label className="!m-0">Active</Label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Create</Button>
                  <Button type="button" variant="outline" onClick={() => pushNow()}>Create later, push now</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Push Media to Multiple Buses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label>1) Choose Depot</Label>
                <Select value={targetDepot || "__ALL__"} onValueChange={(v) => setTargetDepot(v === "__ALL__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Depots" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All Depots</SelectItem>
                    {uttarakhandDepots.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Click on a bus number to see and pre-select its currently streaming ads
                </p>
                <div className="mt-3 max-h-56 overflow-auto border rounded-md">
                  {buses
                    .filter(b => !targetDepot || b.depo === targetDepot)
                    .map(b => (
                      <div key={b.id} className="flex items-center gap-2 p-2 hover:bg-muted">
                        <input type="checkbox" checked={selectedBusIds.includes(b.id)} onChange={() => toggleBus(b.id)} />
                        <button
                          type="button"
                          onClick={() => handleBusClick(b.id)}
                          disabled={loadingBusMedia}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          title="Click to see currently streaming ads for this bus"
                        >
                          {b.bus_number} {b.depo ? `( ${b.depo} )` : ''}
                          {loadingBusMedia && <span className="text-xs">⏳</span>}
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <Label>2) Upload or Select Media</Label>
                <div className="flex items-center gap-3">
                  <Input type="file" accept="video/*,image/*" onChange={onUploadFile} disabled={uploading} />
                  <Button type="button" variant="outline" onClick={() => fetch(`${backendUrl}/api/media/public`).then(r => r.json()).then((l) => setMediaItems(Array.isArray(l) ? l : []) )}>Refresh</Button>
                </div>
                <div className="mt-3 max-h-56 overflow-auto border rounded-md">
                  {mediaItems.map((m, idx) => (
                    <label key={`${m.url}-${idx}`} className="flex items-center gap-2 p-2 hover:bg-muted">
                      <input type="checkbox" checked={selectedMediaIdx.includes(idx)} onChange={() => toggleMedia(idx)} />
                      <span className="text-sm truncate" title={m.url}>
                        {m.name || 'Media'} — {m.type}
                        {selectedMediaIdx.includes(idx) && (
                          <span className="ml-2 text-xs text-green-600 font-medium">✓ Currently streaming</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>3) Push</Label>
                <p className="text-sm text-muted-foreground mb-2">Replaces all existing media on selected buses with the new media items.</p>
                <div className="flex items-center gap-3">
                  <Button type="button" onClick={assignSelectedMediaToBuses} disabled={assigning}>
                    {assigning ? 'Replacing...' : 'Replace Media on Selected Buses'}
                  </Button>
                  {assignProgress && (
                    <span className="text-sm text-muted-foreground">{assignProgress.done}/{assignProgress.total}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((n) => (
              <div key={n.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="font-medium">{n.title || n.content || "Untitled"}</div>
                <div className="flex items-center gap-3">
                  <span className="text-xs">Priority {n.priority}</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={n.is_active} onCheckedChange={(v) => toggleActive(n.id, v)} />
                    <span className="text-xs">Active</span>
                  </div>
                  <Button size="sm" onClick={() => pushNow(n)}>Push</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default News;


