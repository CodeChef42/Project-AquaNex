import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import PipelinesManagementPage from "./pages/pipeline/PipelinesManagementPage";
import IncidentDetail from "./pages/pipeline/IncidentDetail";
import AlertList from "./pages/pipeline/AlertList";
import SoilSalinity from "./pages/SoilSalinity";
import ZoneDetail from "./pages/soil/ZoneDetail";
import AnomalyAnalysis from "./pages/AnomalyAnalysis";
import WaterQuality from "./pages/WaterQuality";
import DemandForecasting from "./pages/DemandForecasting";
import HistoryLog from "./pages/HistoryLog";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper component for protected routes with MainLayout
const ProtectedRoute = () => {
  console.log("ProtectedRoute rendering");
  // Add any authentication logic here if needed
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Protected routes with MainLayout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pipeline" element={<PipelinesManagementPage />} />
            <Route path="/pipeline/incident/:incidentId" element={<IncidentDetail />} />
            <Route path="/pipeline/alerts" element={<AlertList />} />
            <Route path="/soil-salinity" element={<SoilSalinity />} />
            <Route path="/soil-salinity/zone/:zoneId" element={<ZoneDetail />} />
            <Route path="/anomaly-analysis" element={<AnomalyAnalysis />} />
            <Route path="/water-quality" element={<WaterQuality />} />
            <Route path="/demand-forecasting" element={<DemandForecasting />} />
            <Route path="/history" element={<HistoryLog />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          
          {/* Redirect from old paths to new ones */}
          <Route path="/pipeline/incidents/:incidentId" element={<Navigate to="/pipeline/incident/:incidentId" replace />} />
          
          {/* 404 - Keep this last */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
