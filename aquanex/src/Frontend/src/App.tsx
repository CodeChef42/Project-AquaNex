import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import MainLayout from "./components/layout/MainLayout";
import LandingPage from "./pages/LandingPage";
import Home from "./pages/Home";
import PipelinesManagementPage from "./pages/pipeline/PipelinesManagementPage";
import IncidentDetail from "./pages/pipeline/IncidentDetail";
import AlertList from "./pages/pipeline/AlertList";
import SoilSalinity from "./pages/SoilSalinity";
import ZoneDetail from "./pages/soil/ZoneDetail";
import IncidentAnalysis from "./pages/IncidentAnalysis";
import WaterQuality from "./pages/WaterQuality";
import DemandForecasting from "./pages/DemandForecasting";
import HistoryLog from "./pages/HistoryLog";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper component for protected routes with MainLayout
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  
  console.log("ProtectedRoute rendering", { isAuthenticated, loading });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            
            {/* Protected routes with MainLayout */}
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<Home />} />
              <Route path="/pipeline" element={<PipelinesManagementPage />} />
              <Route path="/pipeline/incident/:incidentId" element={<IncidentDetail />} />
              <Route path="/pipeline/alerts" element={<AlertList />} />
              <Route path="/soil-salinity" element={<SoilSalinity />} />
              <Route path="/soil-salinity/zone/:zoneId" element={<ZoneDetail />} />
              <Route path="/incident-analytics" element={<IncidentAnalysis />} />
              <Route path="/water-quality" element={<WaterQuality />} />
              <Route path="/demand-forecasting" element={<DemandForecasting />} />
              <Route path="/history" element={<HistoryLog />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            
            {/* Redirect from old paths to new ones */}
            <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            <Route path="/incident-analysis" element={<Navigate to="/incident-analytics" replace />} />
            <Route path="/pipeline/incidents/:incidentId" element={<Navigate to="/pipeline/incident/:incidentId" replace />} />
            
            {/* 404 - Keep this last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
