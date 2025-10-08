import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bus, Tv, Calendar, FileVideo, MapPin, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.15),transparent_70%)]" />
        
        <div className="relative container mx-auto px-4 py-20">
          <div className="text-center space-y-8 max-w-4xl mx-auto animate-fade-in">
            <div className="inline-flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-full px-6 py-2 mb-8">
              <Zap className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-sm font-medium">Next-Generation Digital Signage Platform</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                FleetSignage
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Complete digital signage and transport management solution for up to 1000 buses. 
              Stream content, track GPS, and manage your fleet in real-time.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Button
                size="lg"
                className="gap-2 text-lg px-8 py-6 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity shadow-lg shadow-primary/30"
                onClick={() => navigate("/auth")}
              >
                Get Started
                <Bus className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-lg px-8 py-6 border-primary/20 hover:bg-primary/10"
                onClick={() => navigate("/display")}
              >
                View Demo Display
                <Tv className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Bus,
              title: "Fleet Management",
              description: "Manage up to 1000 buses with real-time status monitoring and GPS tracking",
              gradient: "from-primary to-primary-glow",
            },
            {
              icon: FileVideo,
              title: "Media Library",
              description: "Upload and organize videos, images with cloud storage integration",
              gradient: "from-accent to-yellow-500",
            },
            {
              icon: Calendar,
              title: "Smart Scheduling",
              description: "Schedule content deployment across your entire fleet or specific routes",
              gradient: "from-purple-500 to-pink-500",
            },
            {
              icon: MapPin,
              title: "GPS Tracking",
              description: "Real-time location tracking with interactive maps powered by Leaflet",
              gradient: "from-green-500 to-emerald-500",
            },
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-6 bg-card border border-primary/20 rounded-2xl hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech Stack Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Built with Modern Technology
          </h2>
          <p className="text-muted-foreground text-lg">
            Powered by React, TypeScript, and Lovable Cloud (Supabase)
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { title: "React + TypeScript", desc: "Modern, type-safe frontend" },
            { title: "Lovable Cloud", desc: "Scalable backend infrastructure" },
            { title: "Real-time Updates", desc: "WebSocket-powered live data" },
          ].map((tech) => (
            <div key={tech.title} className="p-6 bg-card/50 border border-primary/10 rounded-xl text-center">
              <h4 className="font-semibold mb-2">{tech.title}</h4>
              <p className="text-sm text-muted-foreground">{tech.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-primary/20 rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Fleet?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join modern transport operators using FleetSignage for digital signage and fleet management
          </p>
          <Button
            size="lg"
            className="gap-2 text-lg px-8 py-6 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg shadow-primary/30"
            onClick={() => navigate("/auth")}
          >
            Start Free Trial
            <Zap className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
