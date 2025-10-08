import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
}

const FleetManagement = () => {
  const [buses, setBuses] = useState<BusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busNumber, setBusNumber] = useState("");
  const [routeName, setRouteName] = useState("");
  const [status, setStatus] = useState<"active" | "maintenance" | "offline">("active");

  useEffect(() => {
    fetchBuses();

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

  const fetchBuses = async () => {
    try {
      const { data, error } = await supabase
        .from('buses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBuses(data || []);
    } catch (error) {
      console.error('Error fetching buses:', error);
      toast.error("Failed to load buses");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('buses')
        .insert([
          { bus_number: busNumber, route_name: routeName, status }
        ]);

      if (error) throw error;

      toast.success("Bus added successfully");
      setDialogOpen(false);
      setBusNumber("");
      setRouteName("");
      setStatus("active");
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

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-primary to-primary-glow">
                <Plus className="w-4 h-4" />
                Add Bus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Bus</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddBus} className="space-y-4">
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
                <Button type="submit" className="w-full">
                  Add Bus
                </Button>
              </form>
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
                  <div className="pt-2 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Track Live
                    </Button>
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
