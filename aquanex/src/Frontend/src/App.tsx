import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { SimulationProvider } from "./contexts/SimulationContext";
import MainLayout from "./components/layout/MainLayout";

const LandingPage             = lazy(() => import("./pages/LandingPage"));
const Home                    = lazy(() => import("./pages/Home"));
const PipelinesManagementPage = lazy(() => import("./pages/pipeline/PipelinesManagementPage"));
const IncidentDetail          = lazy(() => import("./pages/pipeline/IncidentDetail"));
const AlertList               = lazy(() => import("./pages/pipeline/AlertList"));
const PipelineResources       = lazy(() => import("./pages/pipeline/PipelineResources"));
const SoilSalinity            = lazy(() => import("./pages/SoilSalinity"));
const ZoneDetail              = lazy(() => import("./pages/soil/ZoneDetail"));
const IncidentAnalysis        = lazy(() => import("./pages/IncidentAnalysis"));
const WaterQuality            = lazy(() => import("./pages/WaterQuality"));
const DemandForecasting       = lazy(() => import("./pages/DemandForecasting"));
const HistoryLog              = lazy(() => import("./pages/HistoryLog"));
const Settings                = lazy(() => import("./pages/Settings"));
const Simulation              = lazy(() => import("./pages/Simulation"));
const Workspaces              = lazy(() => import("./pages/Workspaces"));
const SignIn                  = lazy(() => import("./pages/SignIn"));
const SignUp                  = lazy(() => import("./pages/SignUp"));
const Onboarding              = lazy(() => import("./pages/onboarding/Onboarding"));
const NotFound                = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>;
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

// Guards a route by checking if the module is in the workspace
const ModuleRoute = ({ module }: { module: string }) => {
  const { workspace } = useAuth();
  if (!workspace) {
    return <Navigate to="/workspaces" replace />;
  }
  if (workspace && !workspace.modules.includes(module)) {
    return <Navigate to="/home" replace />;
  }
  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SimulationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>}>
              <Routes>
                {/* Public routes */}
                <Route path="/"           element={<LandingPage />} />
                <Route path="/signin"     element={<SignIn />} />
                <Route path="/signup"     element={<SignUp />} />
                <Route path="/onboarding" element={<Onboarding />} />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/home"     element={<Home />} />
                  <Route path="/workspaces" element={<Workspaces />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/simulation" element={<Simulation />} />

                  <Route element={<ModuleRoute module="pipeline_management" />}>
                    <Route path="/pipeline"                      element={<PipelinesManagementPage />} />
                    <Route path="/pipeline/incident/:incidentId" element={<IncidentDetail />} />
                    <Route path="/pipeline/alerts"               element={<AlertList />} />
                    <Route path="/pipeline/resources/:incidentId" element={<PipelineResources />} />
                  </Route>

                  <Route element={<ModuleRoute module="soil_salinity" />}>
                    <Route path="/soil-salinity"                 element={<SoilSalinity />} />
                    <Route path="/soil-salinity/zone/:zoneId"    element={<ZoneDetail />} />
                  </Route>

                  <Route element={<ModuleRoute module="incident_analytics" />}>
                    <Route path="/incident-analytics"            element={<IncidentAnalysis />} />
                  </Route>

                  <Route element={<ModuleRoute module="water_quality" />}>
                    <Route path="/water-quality"                 element={<WaterQuality />} />
                  </Route>

                  <Route element={<ModuleRoute module="demand_forecasting" />}>
                    <Route path="/demand-forecasting"            element={<DemandForecasting />} />
                  </Route>

                  <Route element={<ModuleRoute module="history_log" />}>
                    <Route path="/history"                       element={<HistoryLog />} />
                  </Route>
                </Route>

                {/* Redirects */}
                <Route path="/dashboard"         element={<Navigate to="/home" replace />} />
                <Route path="/incident-analysis" element={<Navigate to="/incident-analytics" replace />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </SimulationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
