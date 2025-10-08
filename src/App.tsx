import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import FleetManagement from "./pages/FleetManagement";
import NotFound from "./pages/NotFound";
import Media from "./pages/Media";
import Schedules from "./pages/Schedules";
import News from "./pages/News";
import Display from "./pages/Display";
import DisplayConfig from "./pages/DisplayConfig";
import GpsSimulator from "./pages/GpsSimulator";
import Presets from "./pages/Presets";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/fleet" element={<FleetManagement />} />
          <Route path="/media" element={<Media />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/news" element={<News />} />
          <Route path="/display" element={<Display />} />
          <Route path="/display-config" element={<DisplayConfig />} />
          <Route path="/simulator" element={<GpsSimulator />} />
          <Route path="/presets" element={<Presets />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
