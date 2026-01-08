import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Bus, Plus, MapPin, Clock, Trash } from "lucide-react";
import { toast } from "sonner";

interface BusData {
  id: string;
  bus_number: string;
  route_name: string;
  status: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  last_location_update: string | null;
  preset_id?: string | null;
  driver_name?: string | null;
  conductor_name?: string | null;
  driver_phone?: string | null;
  conductor_phone?: string | null;
  start_point?: string | null;
  end_point?: string | null;
  depo?: string | null;
  category?: string | null;
  sitting_capacity?: number | null;
  running_hours?: number | null;
  bus_type?: string | null;
  route_id?: string | null;
}

const FleetManagement = () => {
  const [buses, setBuses] = useState<BusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<BusData | null>(null);
  const uttarakhandDepots = [
    "Dehradun Depot",
    "Haridwar Depot",
    "Rishikesh Depot",
    "Roorkee Depot",
    "Haldwani Depot",
    "Nainital Depot",
    "Almora Depot",
    "Ranikhet Depot",
    "Pithoragarh Depot",
    "Champawat Depot",
    "Bageshwar Depot",
    "Kausani Depot",
    "Tanakpur Depot",
    "Khatima Depot",
    "Kashipur Depot",
    "Rudrapur Depot",
    "Sitarganj Depot",
    "Jaspur Depot",
    "Bazpur Depot",
    "Mussoorie Depot",
    "Vikasnagar Depot",
    "Doiwala Depot",
    "Pauri Depot",
    "Kotdwar Depot",
    "Srinagar (Garhwal) Depot",
    "Devprayag Depot",
    "Tehri Depot",
    "New Tehri Depot",
    "Uttarkashi Depot",
    "Joshimath Depot",
    "Gopeshwar (Chamoli) Depot",
    "Rudraprayag Depot",
    "Lansdowne Depot",
    "Kichha Depot"
  ];
  const [selectedDepotFilter, setSelectedDepotFilter] = useState<string>("");
  const [busNumber, setBusNumber] = useState("");
  const [routeName, setRouteName] = useState("");
  const [status, setStatus] = useState<"active" | "maintenance" | "offline">("active");
  const [presets, setPresets] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [driverName, setDriverName] = useState("");
  const [conductorName, setConductorName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [conductorPhone, setConductorPhone] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [endPoint, setEndPoint] = useState("");
  const [startLatitude, setStartLatitude] = useState<string>("");
  const [startLongitude, setStartLongitude] = useState<string>("");
  const [endLatitude, setEndLatitude] = useState<string>("");
  const [endLongitude, setEndLongitude] = useState<string>("");
  const [depo, setDepo] = useState("");
  const [customDepot, setCustomDepot] = useState("");
  const [category, setCategory] = useState<"ev" | "small_bus" | "big_bus">("big_bus");
  const [sittingCapacity, setSittingCapacity] = useState<number>(48);
  const [runningHours, setRunningHours] = useState<12 | 15 | 24>(12);
  const [busType, setBusType] = useState<"volvo" | "ac" | "non_ac">("non_ac");
  // Edit form state
  const [eBusNumber, setEBusNumber] = useState("");
  const [eRouteName, setERouteName] = useState("");
  const [eStatus, setEStatus] = useState<"active" | "maintenance" | "offline">("active");
  const [eDriverName, setEDriverName] = useState("");
  const [eConductorName, setEConductorName] = useState("");
  const [eDriverPhone, setEDriverPhone] = useState("");
  const [eConductorPhone, setEConductorPhone] = useState("");
  const [eStartPoint, setEStartPoint] = useState("");
  const [eEndPoint, setEEndPoint] = useState("");
  const [eStartLatitude, setEStartLatitude] = useState<string>("");
  const [eStartLongitude, setEStartLongitude] = useState<string>("");
  const [eEndLatitude, setEEndLatitude] = useState<string>("");
  const [eEndLongitude, setEEndLongitude] = useState<string>("");
  const [eDepo, setEDepo] = useState("");
  const [eCustomDepot, setECustomDepot] = useState("");
  const [eCategory, setECategory] = useState<"ev" | "small_bus" | "big_bus">("big_bus");
  const [eSittingCapacity, setESittingCapacity] = useState<number>(48);
  const [eRunningHours, setERunningHours] = useState<12 | 15 | 24>(12);
  const [eBusType, setEBusType] = useState<"volvo" | "ac" | "non_ac">("non_ac");

  // --- Live Positions ---
  type Position = { lat: number | null; lng: number | null; last: string | null; status?: string | null; depot?: string | null };
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const BACKEND_URL = (() => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://localhost:4000';
    }
    return 'https://transport-display.onrender.com';
  })();

  // Midpoints state for Edit dialog
  type MidpointRow = { id?: string; name: string; latitude: string; longitude: string; radius_m: string; order_index: number };
  const [eMidpoints, setEMidpoints] = useState<MidpointRow[]>([]);

  useEffect(() => {
    fetchBuses();
    fetchPresets();

    const channel = supabase
      .channel('fleet-buses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, () => {
        fetchBuses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Poll last known positions for all buses every 5s
  useEffect(() => {
    let mounted = true;
    let timer: any;
    const fetchPositions = async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/buses/public/positions`, { credentials: 'omit' });
        const j = await r.json();
        if (!mounted || !Array.isArray(j)) return;
        const map: Record<string, Position> = {};
        for (const it of j) {
          map[it.bus_number] = { lat: it.lat ?? null, lng: it.lng ?? null, last: it.last_location_update ?? null, status: it.status ?? null, depot: it.depot ?? null };
        }
        setPositions(map);
      } catch (e) {
        // swallow; keep previous positions
      }
    };
    fetchPositions();
    timer = setInterval(fetchPositions, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    // Refetch whenever depot filter changes
    fetchBuses();
  }, [selectedDepotFilter]);

  const fetchBuses = async () => {
    try {
      let query: any = supabase
        .from('buses')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedDepotFilter) {
        query = query.eq('depo', selectedDepotFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBuses(data || []);
    } catch (error) {
      console.error('Error fetching buses:', error);
      toast.error("Failed to load buses");
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    const { data } = await (supabase as any).from("display_presets").select("id,name").order("created_at", { ascending: false });
    setPresets((data as any) || []);
  };

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('buses')
        .insert([
          { 
            bus_number: busNumber, 
            route_name: routeName, 
            status,
            preset_id: selectedPreset || null,
            driver_name: driverName,
            conductor_name: conductorName,
            driver_phone: driverPhone,
            conductor_phone: conductorPhone,
            start_point: startPoint,
            end_point: endPoint,
            start_latitude: startLatitude ? Number(startLatitude) : null,
            start_longitude: startLongitude ? Number(startLongitude) : null,
            end_latitude: endLatitude ? Number(endLatitude) : null,
            end_longitude: endLongitude ? Number(endLongitude) : null,
            depo: depo === "Other (Custom)" ? (customDepot || null) : depo,
            category: category,
            sitting_capacity: sittingCapacity,
            running_hours: runningHours,
            bus_type: busType
          }
        ]);

      if (error) throw error;

      toast.success("Bus added successfully");
      setDialogOpen(false);
      setBusNumber("");
      setRouteName("");
      setStatus("active");
      setSelectedPreset("");
      setDriverName("");
      setConductorName("");
      setDriverPhone("");
      setConductorPhone("");
      setStartPoint("");
      setEndPoint("");
      setStartLatitude("");
      setStartLongitude("");
      setEndLatitude("");
      setEndLongitude("");
      setDepo("");
      setCategory("big_bus");
      setSittingCapacity(48);
      setRunningHours(12);
      setBusType("non_ac");
    } catch (error: any) {
      toast.error(error.message || "Failed to add bus");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'maintenance':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'offline':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const openEditFor = (bus: BusData) => {
    setEditingBus(bus);
    setEBusNumber(bus.bus_number || "");
    setERouteName(bus.route_name || "");
    setEStatus((bus.status as any) || "active");
    setEDriverName(bus.driver_name || "");
    setEConductorName(bus.conductor_name || "");
    setEDriverPhone(bus.driver_phone || "");
    setEConductorPhone(bus.conductor_phone || "");
    setEStartPoint(bus.start_point || "");
    setEEndPoint(bus.end_point || "");
    setEStartLatitude((((bus as any).start_latitude) ?? "").toString());
    setEStartLongitude((((bus as any).start_longitude) ?? "").toString());
    setEEndLatitude((((bus as any).end_latitude) ?? "").toString());
    setEEndLongitude((((bus as any).end_longitude) ?? "").toString());
    setEDepo(bus.depo || "");
    setECustomDepot("");
    setECategory((bus.category as any) || "big_bus");
    setESittingCapacity((bus.sitting_capacity as any) || 48);
    setERunningHours((bus.running_hours as any) || 12);
    setEBusType((bus.bus_type as any) || "non_ac");
    setEditDialogOpen(true);

    // Load midpoints for this bus
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('route_midpoints')
          .select('id,name,lat,lng,radius_m,order_index,active')
          .eq('bus_number', bus.bus_number)
          .eq('active', true)
          .order('order_index', { ascending: true });
        const rows: MidpointRow[] = (data || []).map((r: any, idx: number) => ({
          id: r.id,
          name: r.name || '',
          latitude: String(r.lat ?? ''),
          longitude: String(r.lng ?? ''),
          radius_m: String(r.radius_m ?? '150'),
          order_index: Number(r.order_index ?? idx)
        }));
        setEMidpoints(rows);
      } catch {
        setEMidpoints([]);
      }
    })();
  };

  const handleUpdateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBus) return;
    try {
      const updates: any = {
        bus_number: eBusNumber,
        route_name: eRouteName,
        status: eStatus,
        driver_name: eDriverName || null,
        conductor_name: eConductorName || null,
        driver_phone: eDriverPhone || null,
        conductor_phone: eConductorPhone || null,
        start_point: eStartPoint || null,
        end_point: eEndPoint || null,
        start_latitude: eStartLatitude ? Number(eStartLatitude) : null,
        start_longitude: eStartLongitude ? Number(eStartLongitude) : null,
        end_latitude: eEndLatitude ? Number(eEndLatitude) : null,
        end_longitude: eEndLongitude ? Number(eEndLongitude) : null,
        depo: eDepo === 'Other (Custom)' ? (eCustomDepot || null) : eDepo || null,
        category: eCategory,
        sitting_capacity: eSittingCapacity,
        running_hours: eRunningHours,
        bus_type: eBusType,
      };

      const { error } = await supabase.from('buses').update(updates).eq('id', editingBus.id);
      if (error) throw error;

      // Save midpoints after bus core fields are saved (use possibly edited bus number)
      await saveMidpoints(eBusNumber);
      toast.success('Bus updated');
      setEditDialogOpen(false);
      setEditingBus(null);
      fetchBuses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update bus');
    }
  };

  const addMidpointRow = () => {
    setEMidpoints((prev) => ([
      ...prev,
      { name: '', latitude: '', longitude: '', radius_m: '150', order_index: prev.length }
    ]));
  };

  const removeMidpointRow = (idx: number) => {
    setEMidpoints((prev) => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order_index: i })));
  };

  const updateMidpointField = (idx: number, field: keyof MidpointRow, value: string) => {
    setEMidpoints((prev) => prev.map((r, i) => i === idx ? ({ ...r, [field]: value }) as MidpointRow : r));
  };

  const saveMidpoints = async (busNumber: string) => {
    try {
      // Normalize rows to insert (no id)
      const rows = eMidpoints
        .filter(r => r.name && r.latitude && r.longitude)
        .map(r => ({
          bus_number: busNumber,
          name: r.name,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          radius_m: r.radius_m ? Number(r.radius_m) : 150,
          order_index: Number(r.order_index ?? 0),
          active: true,
        }));

      // Replace strategy: delete all for this bus, then insert current set
      const { error: delErr } = await (supabase as any)
        .from('route_midpoints')
        .delete()
        .eq('bus_number', busNumber);
      if (delErr) throw delErr;

      if (rows.length > 0) {
        const { error: insErr } = await (supabase as any)
          .from('route_midpoints')
          .insert(rows);
        if (insErr) throw insErr;
        toast.success(`Saved ${rows.length} midpoint(s)`);
      } else {
        toast.info('No midpoints to save');
      }
    } catch (err: any) {
      console.error('Failed saving midpoints', err);
      toast.error(err.message || 'Failed to save midpoints');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Fleet Management
            </h1>
            <p className="text-muted-foreground">
              Manage and monitor your bus fleet
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-64">
              <Label>Filter by Depot</Label>
              <Select value={selectedDepotFilter || "__ALL__"} onValueChange={(v) => setSelectedDepotFilter(v === "__ALL__" ? "" : v)}>
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
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-primary to-primary-glow">
                <Plus className="w-4 h-4" />
                Add Bus
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add New Bus</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 pr-2 space-y-4">
                <form id="add-bus-form" onSubmit={handleAddBus} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bus-number">Bus Number</Label>
                  <Input
                    id="bus-number"
                    placeholder="e.g., BUS-001"
                    value={busNumber}
                    onChange={(e) => setBusNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="route-name">Route Name</Label>
                  <Input
                    id="route-name"
                    placeholder="e.g., Downtown Loop"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as "active" | "maintenance" | "offline")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Driver Name</Label>
                  <Input
                    placeholder="Driver Name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conductor Name</Label>
                  <Input
                    placeholder="Conductor Name"
                    value={conductorName}
                    onChange={(e) => setConductorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Driver Phone</Label>
                  <Input
                    placeholder="Driver Phone"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conductor Phone</Label>
                  <Input
                    placeholder="Conductor Phone"
                    value={conductorPhone}
                    onChange={(e) => setConductorPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Point</Label>
                  <Input
                    placeholder="Start Point"
                    value={startPoint}
                    onChange={(e) => setStartPoint(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Latitude</Label>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="e.g., 30.3165"
                      value={startLatitude}
                      onChange={(e) => setStartLatitude(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Longitude</Label>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="e.g., 78.0322"
                      value={startLongitude}
                      onChange={(e) => setStartLongitude(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Point</Label>
                  <Input
                    placeholder="End Point"
                    value={endPoint}
                    onChange={(e) => setEndPoint(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>End Latitude</Label>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="e.g., 29.9457"
                      value={endLatitude}
                      onChange={(e) => setEndLatitude(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Longitude</Label>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="e.g., 78.1642"
                      value={endLongitude}
                      onChange={(e) => setEndLongitude(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Depot</Label>
                  <Select value={depo} onValueChange={(v) => { setDepo(v); if (v !== "Other (Custom)") setCustomDepot(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Depot" />
                    </SelectTrigger>
                    <SelectContent>
                      {uttarakhandDepots.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                      <SelectItem value="Other (Custom)">Other (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  {depo === "Other (Custom)" && (
                    <Input
                      className="mt-2"
                      placeholder="Enter custom depot name"
                      value={customDepot}
                      onChange={(e) => setCustomDepot(e.target.value)}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as "ev" | "small_bus" | "big_bus")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ev">EV</SelectItem>
                      <SelectItem value="small_bus">Small Bus</SelectItem>
                      <SelectItem value="big_bus">Big Bus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sitting Capacity</Label>
                  <Input
                    type="number"
                    placeholder="Sitting Capacity"
                    value={sittingCapacity}
                    onChange={(e) => setSittingCapacity(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Running Hours</Label>
                  <Select value={String(runningHours)} onValueChange={(value) => setRunningHours(Number(value) as 12 | 15 | 24)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 Hours</SelectItem>
                      <SelectItem value="15">15 Hours</SelectItem>
                      <SelectItem value="24">24 Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bus Type</Label>
                  <Select value={busType} onValueChange={(value) => setBusType(value as "volvo" | "ac" | "non_ac")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volvo">Volvo</SelectItem>
                      <SelectItem value="ac">AC</SelectItem>
                      <SelectItem value="non_ac">Non-AC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign Preset (optional)</Label>
                  <Select value={selectedPreset} onValueChange={(v) => setSelectedPreset(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                </form>
              </div>
              <DialogFooter className="flex-shrink-0 pt-4">
                <Button type="submit" form="add-bus-form" className="w-full">
                  Add Bus
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-40" />
              </Card>
            ))}
          </div>
        ) : buses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bus className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Buses Yet</h3>
              <p className="text-muted-foreground mb-4">Add your first bus to get started</p>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Bus
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {buses.map((bus, index) => (
              <Card 
                key={bus.id} 
                className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 border-primary/20 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg group-hover:scale-110 transition-transform">
                        <Bus className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{bus.bus_number}</CardTitle>
                        <p className="text-sm text-muted-foreground">{bus.route_name}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(bus.status)}>
                      {bus.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Live position (polled) */}
                  {(() => {
                    const p = positions[bus.bus_number];
                    const hasFix = p && typeof p.lat === 'number' && typeof p.lng === 'number';
                    const ageStr = p?.last ? new Date(p.last).toLocaleString() : null;
                    return (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {hasFix ? `${(p!.lat as number).toFixed(4)}, ${(p!.lng as number).toFixed(4)}` : 'Location not available'}
                          </span>
                          {hasFix && (
                            <a
                              className="ml-auto text-primary underline text-xs"
                              href={`https://www.google.com/maps?q=${p!.lat},${p!.lng}`}
                              target="_blank" rel="noreferrer"
                            >View</a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {ageStr ? ageStr : 'No recent update'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                  {bus.driver_name && (
                    <div className="text-sm text-muted-foreground">
                      Driver: {bus.driver_name} ({bus.driver_phone})
                    </div>
                  )}
                  {bus.conductor_name && (
                    <div className="text-sm text-muted-foreground">
                      Conductor: {bus.conductor_name} ({bus.conductor_phone})
                    </div>
                  )}
                  {bus.start_point && bus.end_point && (
                    <div className="text-sm text-muted-foreground">
                      Route: {bus.start_point} → {bus.end_point}
                    </div>
                  )}
                  {(bus as any).start_latitude && (bus as any).start_longitude && (
                    <div className="text-xs text-muted-foreground">
                      Start: {(bus as any).start_latitude.toFixed ? (bus as any).start_latitude.toFixed(4) : (bus as any).start_latitude}, {(bus as any).start_longitude.toFixed ? (bus as any).start_longitude.toFixed(4) : (bus as any).start_longitude}
                    </div>
                  )}
                  {(bus as any).end_latitude && (bus as any).end_longitude && (
                    <div className="text-xs text-muted-foreground">
                      End: {(bus as any).end_latitude.toFixed ? (bus as any).end_latitude.toFixed(4) : (bus as any).end_latitude}, {(bus as any).end_longitude.toFixed ? (bus as any).end_longitude.toFixed(4) : (bus as any).end_longitude}
                    </div>
                  )}
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {bus.category && <span className="px-2 py-1 bg-blue-100 rounded">{bus.category}</span>}
                    {bus.bus_type && <span className="px-2 py-1 bg-green-100 rounded">{bus.bus_type}</span>}
                    {bus.sitting_capacity && <span className="px-2 py-1 bg-purple-100 rounded">{bus.sitting_capacity} seats</span>}
                    {bus.running_hours && <span className="px-2 py-1 bg-orange-100 rounded">{bus.running_hours}h</span>}
                  </div>
                  <div className="pt-2 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/display?deviceId=${bus.bus_number}${bus.preset_id ? `&presetId=${bus.preset_id}` : ''}&showRoute=1&showTrail=1&osrm=1`)}>
                      Copy Display Link
                    </Button>
                    <Link to={`/display?${new URLSearchParams({ deviceId: bus.bus_number, ...(bus.preset_id ? { presetId: bus.preset_id } : {}), showRoute: '1', showTrail: '1', osrm: '1' }).toString()}`} target="_blank" rel="noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">Open Display</Button>
                    </Link>
                    <Button size="sm" className="flex-1" onClick={() => openEditFor(bus)}>Edit</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Edit Bus Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit Bus</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              <form id="edit-bus-form" onSubmit={handleUpdateBus} className="space-y-4">
                <div className="space-y-2">
                  <Label>Bus Number</Label>
                  <Input value={eBusNumber} onChange={(e)=>setEBusNumber(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Route Name</Label>
                  <Input value={eRouteName} onChange={(e)=>setERouteName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={eStatus} onValueChange={(v)=>setEStatus(v as any)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Driver Name</Label><Input value={eDriverName} onChange={(e)=>setEDriverName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Conductor Name</Label><Input value={eConductorName} onChange={(e)=>setEConductorName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Driver Phone</Label><Input value={eDriverPhone} onChange={(e)=>setEDriverPhone(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Conductor Phone</Label><Input value={eConductorPhone} onChange={(e)=>setEConductorPhone(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Start Point</Label><Input value={eStartPoint} onChange={(e)=>setEStartPoint(e.target.value)} /></div>
                  <div className="space-y-2"><Label>End Point</Label><Input value={eEndPoint} onChange={(e)=>setEEndPoint(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Start Latitude</Label><Input type="number" step="0.00000001" value={eStartLatitude} onChange={(e)=>setEStartLatitude(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Start Longitude</Label><Input type="number" step="0.00000001" value={eStartLongitude} onChange={(e)=>setEStartLongitude(e.target.value)} /></div>
                  <div className="space-y-2"><Label>End Latitude</Label><Input type="number" step="0.00000001" value={eEndLatitude} onChange={(e)=>setEEndLatitude(e.target.value)} /></div>
                  <div className="space-y-2"><Label>End Longitude</Label><Input type="number" step="0.00000001" value={eEndLongitude} onChange={(e)=>setEEndLongitude(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Depot</Label>
                  <Select value={eDepo} onValueChange={(v)=>{ setEDepo(v); if (v !== "Other (Custom)") setECustomDepot(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select Depot"/></SelectTrigger>
                    <SelectContent>
                      {uttarakhandDepots.map((d)=>(<SelectItem key={d} value={d}>{d}</SelectItem>))}
                      <SelectItem value="Other (Custom)">Other (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  {eDepo === "Other (Custom)" && (
                    <Input className="mt-2" placeholder="Enter custom depot name" value={eCustomDepot} onChange={(e)=>setECustomDepot(e.target.value)} />
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={eCategory} onValueChange={(v)=>setECategory(v as any)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ev">EV</SelectItem>
                        <SelectItem value="small_bus">Small Bus</SelectItem>
                        <SelectItem value="big_bus">Big Bus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Sitting Capacity</Label><Input type="number" value={eSittingCapacity} onChange={(e)=>setESittingCapacity(Number(e.target.value))} /></div>
                  <div className="space-y-2">
                    <Label>Running Hours</Label>
                    <Select value={String(eRunningHours)} onValueChange={(v)=>setERunningHours(Number(v) as any)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 Hours</SelectItem>
                        <SelectItem value="15">15 Hours</SelectItem>
                        <SelectItem value="24">24 Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bus Type</Label>
                  <Select value={eBusType} onValueChange={(v)=>setEBusType(v as any)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volvo">Volvo</SelectItem>
                      <SelectItem value="ac">AC</SelectItem>
                      <SelectItem value="non_ac">Non-AC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Midpoints editor */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Midpoints (Announcements)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMidpointRow} className="gap-2">
                      <Plus className="w-4 h-4"/> Add Point
                    </Button>
                  </div>
                  {eMidpoints.length === 0 && (
                    <div className="text-sm text-muted-foreground">No midpoints yet. Click "Add Point" to create one.</div>
                  )}
                  <div className="space-y-3">
                    {eMidpoints.map((mp, idx) => (
                      <div key={`${mp.id ?? 'new'}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                        <div className="md:col-span-3">
                          <Label>Name</Label>
                          <Input value={mp.name} onChange={(e)=>updateMidpointField(idx,'name',e.target.value)} placeholder="e.g., ISBT"/>
                        </div>
                        <div className="md:col-span-3">
                          <Label>Latitude</Label>
                          <Input type="number" step="0.00000001" value={mp.latitude} onChange={(e)=>updateMidpointField(idx,'latitude',e.target.value)} placeholder="30.3153"/>
                        </div>
                        <div className="md:col-span-3">
                          <Label>Longitude</Label>
                          <Input type="number" step="0.00000001" value={mp.longitude} onChange={(e)=>updateMidpointField(idx,'longitude',e.target.value)} placeholder="78.0322"/>
                        </div>
                        <div className="md:col-span-2">
                          <Label>Radius (m)</Label>
                          <Input type="number" value={mp.radius_m} onChange={(e)=>updateMidpointField(idx,'radius_m',e.target.value)} placeholder="150"/>
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <Button type="button" variant="destructive" size="icon" onClick={()=>removeMidpointRow(idx)}>
                            <Trash className="w-4 h-4"/>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">Announcements will trigger when a bus comes within the configured radius of the nearest midpoint (1km max for approaching).</div>
                </div>
              </form>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4">
              <Button type="submit" form="edit-bus-form" className="w-full">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default FleetManagement;
