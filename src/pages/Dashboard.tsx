import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, FileVideo, Calendar, Tv, TrendingUp, Activity } from "lucide-react";

interface Stats {
  totalBuses: number;
  activeBuses: number;
  mediaItems: number;
  activeSchedules: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalBuses: 0,
    activeBuses: 0,
    mediaItems: 0,
    activeSchedules: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Subscribe to real-time updates
    const busChannel = supabase
      .channel('dashboard-buses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(busChannel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const [busesResult, mediaResult, schedulesResult] = await Promise.all([
        supabase.from('buses').select('id, status', { count: 'exact' }),
        supabase.from('media_content').select('id', { count: 'exact' }),
        supabase.from('schedules').select('id', { count: 'exact' }).eq('is_active', true),
      ]);

      const activeBuses = busesResult.data?.filter(b => b.status === 'active').length || 0;

      setStats({
        totalBuses: busesResult.count || 0,
        activeBuses,
        mediaItems: mediaResult.count || 0,
        activeSchedules: schedulesResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Buses",
      value: stats.totalBuses,
      icon: Bus,
      gradient: "from-primary to-primary-glow",
    },
    {
      title: "Active Buses",
      value: stats.activeBuses,
      icon: Activity,
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: "Media Items",
      value: stats.mediaItems,
      icon: FileVideo,
      gradient: "from-accent to-yellow-500",
    },
    {
      title: "Active Schedules",
      value: stats.activeSchedules,
      icon: Calendar,
      gradient: "from-purple-500 to-pink-500",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground">
            Real-time fleet monitoring and content management
          </p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card 
                  key={stat.title} 
                  className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 border-primary/20 animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stat.value}</div>
                    <div className="flex items-center text-xs text-green-500 mt-2">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      System operational
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                <p className="font-medium">Deploy Content to Fleet</p>
                <p className="text-sm text-muted-foreground">Schedule media across all active buses</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                <p className="font-medium">Add New Bus</p>
                <p className="text-sm text-muted-foreground">Register a new vehicle to the system</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                <p className="font-medium">Upload Media</p>
                <p className="text-sm text-muted-foreground">Add videos and images to library</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database Connection</span>
                <span className="flex items-center text-green-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Cloud Storage</span>
                <span className="flex items-center text-green-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Real-time Updates</span>
                <span className="flex items-center text-green-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">GPS Tracking</span>
                <span className="flex items-center text-green-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Operational
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
