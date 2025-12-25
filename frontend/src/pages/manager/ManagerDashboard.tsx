import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Newspaper, TrendingUp, Activity } from "lucide-react";

interface Stats {
  totalBuses: number;
  activeBuses: number;
  newsItems: number;
  activeNews: number;
}

const ManagerDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalBuses: 0,
    activeBuses: 0,
    newsItems: 0,
    activeNews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Subscribe to real-time updates
    const busChannel = supabase
      .channel('manager-dashboard-buses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, () => {
        fetchStats();
      })
      .subscribe();

    const newsChannel = supabase
      .channel('manager-dashboard-news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_feeds' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(busChannel);
      supabase.removeChannel(newsChannel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const [busesResult, newsResult] = await Promise.all([
        supabase.from('buses').select('id, status', { count: 'exact' }),
        supabase.from('news_feeds').select('id, is_active', { count: 'exact' }),
      ]);

      const activeBuses = busesResult.data?.filter(b => b.status === 'active').length || 0;
      const activeNews = newsResult.data?.filter(n => n.is_active).length || 0;

      setStats({
        totalBuses: busesResult.count || 0,
        activeBuses,
        newsItems: newsResult.count || 0,
        activeNews,
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
      title: "News Items",
      value: stats.newsItems,
      icon: Newspaper,
      gradient: "from-accent to-yellow-500",
    },
    {
      title: "Active News",
      value: stats.activeNews,
      icon: TrendingUp,
      gradient: "from-purple-500 to-pink-500",
    },
  ];

  return (
    <ManagerLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground">Monitor fleet operations and news management</p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-primary/20">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-8 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="border-primary/20 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                      </div>
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
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
                <Bus className="w-5 h-5 text-primary" />
                Fleet Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                <p className="font-medium">View Fleet Status</p>
                <p className="text-sm text-muted-foreground">Monitor all buses and their current status</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                <p className="font-medium">Track Bus Locations</p>
                <p className="text-sm text-muted-foreground">Real-time GPS tracking and route monitoring</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-primary" />
                News Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                <p className="font-medium">Create News Updates</p>
                <p className="text-sm text-muted-foreground">Broadcast news to specific buses or depots</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                <p className="font-medium">Manage Media Assignments</p>
                <p className="text-sm text-muted-foreground">Assign existing media to buses (no upload access)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ManagerLayout>
  );
};

export default ManagerDashboard;
