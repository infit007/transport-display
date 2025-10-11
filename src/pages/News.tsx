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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">News Feeds</h1>
          <p className="text-muted-foreground">Manage and push news updates to displays.</p>
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


