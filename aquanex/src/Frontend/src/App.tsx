import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import MainLayout from "./components/layout/MainLayout";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const Home = lazy(() => import("./pages/Home"));
const PipelinesManagementPage = lazy(() => import("./pages/pipeline/PipelinesManagementPage"));
const IncidentDetail = lazy(() => import("./pages/pipeline/IncidentDetail"));
const AlertList = lazy(() => import("./pages/pipeline/AlertList"));
const SoilSalinity = lazy(() => import("./pages/SoilSalinity"));
const ZoneDetail = lazy(() => import("./pages/soil/ZoneDetail"));
const IncidentAnalysis = lazy(() => import("./pages/IncidentAnalysis"));
const WaterQuality = lazy(() => import("./pages/WaterQuality"));
const DemandForecasting = lazy(() => import("./pages/DemandForecasting"));
const HistoryLog = lazy(() => import("./pages/HistoryLog"));
const Settings = lazy(() => import("./pages/Settings"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Loading...</div>
              </div>
            }
          >
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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
