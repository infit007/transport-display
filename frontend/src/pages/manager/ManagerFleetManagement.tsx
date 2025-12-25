import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bus, MapPin, Users, Phone, Search } from "lucide-react";
import { toast } from "sonner";

interface BusData {
  id: string;
  bus_number: string;
  route_name: string;
  status: 'active' | 'maintenance' | 'offline';
  depo?: string;
  driver_name?: string;
  conductor_name?: string;
  driver_phone?: string;
  conductor_phone?: string;
  start_point?: string;
  end_point?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  last_location_update?: string;
}

const ManagerFleetManagement = () => {
  const [buses, setBuses] = useState<BusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [depotFilter, setDepotFilter] = useState<string>("all");

  const uttarakhandDepots = [
    "Dehradun Depot","Haridwar Depot","Rishikesh Depot","Roorkee Depot","Haldwani Depot","Nainital Depot","Almora Depot","Ranikhet Depot","Pithoragarh Depot","Champawat Depot","Bageshwar Depot","Kausani Depot","Tanakpur Depot","Khatima Depot","Kashipur Depot","Rudrapur Depot","Sitarganj Depot","Jaspur Depot","Bazpur Depot","Mussoorie Depot","Vikasnagar Depot","Doiwala Depot","Pauri Depot","Kotdwar Depot","Srinagar (Garhwal) Depot","Devprayag Depot","Tehri Depot","New Tehri Depot","Uttarkashi Depot","Joshimath Depot","Gopeshwar (Chamoli) Depot","Rudraprayag Depot","Lansdowne Depot","Kichha Depot"
  ];

  useEffect(() => {
    fetchBuses();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('manager-fleet-buses')
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
      toast.error('Failed to load buses');
    } finally {
      setLoading(false);
    }
  };

  const filteredBuses = buses.filter(bus => {
    const matchesSearch = bus.bus_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bus.route_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bus.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bus.conductor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || bus.status === statusFilter;
    const matchesDepot = depotFilter === "all" || bus.depo === depotFilter;
    
    return matchesSearch && matchesStatus && matchesDepot;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'maintenance': return 'Maintenance';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  return (
    <ManagerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Fleet Management</h1>
          <p className="text-muted-foreground">Monitor and manage your bus fleet (View Only)</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search buses, routes, drivers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Depot</Label>
                <Select value={depotFilter} onValueChange={setDepotFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Depots" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Depots</SelectItem>
                    {uttarakhandDepots.map((depot) => (
                      <SelectItem key={depot} value={depot}>{depot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={fetchBuses} variant="outline" className="w-full">
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bus List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bus className="w-5 h-5" />
              Bus Fleet ({filteredBuses.length} buses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBuses.map((bus) => (
                  <div key={bus.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Bus className="w-5 h-5 text-muted-foreground" />
                          <span className="font-semibold text-lg">{bus.bus_number}</span>
                          <Badge className={`${getStatusColor(bus.status)} text-white`}>
                            {getStatusText(bus.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {bus.route_name}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {bus.depo && (
                          <div className="text-muted-foreground">{bus.depo}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {bus.driver_name && `Driver: ${bus.driver_name}`}
                          {bus.conductor_name && ` | Conductor: ${bus.conductor_name}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {bus.driver_phone && `Driver: ${bus.driver_phone}`}
                          {bus.conductor_phone && ` | Conductor: ${bus.conductor_phone}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {bus.start_point && bus.end_point 
                            ? `${bus.start_point} → ${bus.end_point}`
                            : 'Route not specified'
                          }
                        </span>
                      </div>
                    </div>
                    
                    {bus.gps_latitude && bus.gps_longitude && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Last Location: {bus.gps_latitude.toFixed(6)}, {bus.gps_longitude.toFixed(6)}
                        {bus.last_location_update && (
                          <span> • Updated: {new Date(bus.last_location_update).toLocaleString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {filteredBuses.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No buses found matching your criteria.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
};

export default ManagerFleetManagement;
