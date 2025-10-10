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
import { Bus, Plus, MapPin, Clock } from "lucide-react";
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
  const [depo, setDepo] = useState("");
  const [customDepot, setCustomDepot] = useState("");
  const [category, setCategory] = useState<"ev" | "small_bus" | "big_bus">("big_bus");
  const [sittingCapacity, setSittingCapacity] = useState<number>(48);
  const [runningHours, setRunningHours] = useState<12 | 15 | 24>(12);
  const [busType, setBusType] = useState<"volvo" | "ac" | "non_ac">("non_ac");

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

  useEffect(() => {
    // Refetch whenever depot filter changes
    fetchBuses();
  }, [selectedDepotFilter]);

  const fetchBuses = async () => {
    try {
      let query = supabase
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
    const { data } = await supabase.from("display_presets").select("id,name").order("created_at", { ascending: false });
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
              <Select value={selectedDepotFilter} onValueChange={(v) => setSelectedDepotFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Depots" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Depots</SelectItem>
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
                <div className="space-y-2">
                  <Label>End Point</Label>
                  <Input
                    placeholder="End Point"
                    value={endPoint}
                    onChange={(e) => setEndPoint(e.target.value)}
                  />
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
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {bus.gps_latitude && bus.gps_longitude
                        ? `${bus.gps_latitude.toFixed(4)}, ${bus.gps_longitude.toFixed(4)}`
                        : "Location not available"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {bus.last_location_update
                        ? new Date(bus.last_location_update).toLocaleString()
                        : "No recent update"}
                    </span>
                  </div>
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FleetManagement;
