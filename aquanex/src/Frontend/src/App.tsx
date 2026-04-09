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

// Lazy Loaded Pages
const LandingPage             = lazy(() => import("./pages/LandingPage"));
const Home                    = lazy(() => import("./pages/Home"));
const InfoPage                = lazy(() => import("./pages/InfoPage")); // ✅ Added InfoPage
const PipelinesManagementPage = lazy(() => import("./pages/pipeline/PipelinesManagementPage"));
const IncidentDetails         = lazy(() => import("./pages/pipeline/IncidentDetails"));
const AlertList               = lazy(() => import("./pages/pipeline/AlertQueue"));
const PipelineResources       = lazy(() => import("./pages/pipeline/PipelineResources"));
const SoilSalinity            = lazy(() => import("./pages/SoilSalinity"));
const ZoneDetail              = lazy(() => import("./pages/soil/ZoneDetail"));
const IncidentAnalysis        = lazy(() => import("./pages/IncidentAnalytics"));
const WaterQuality            = lazy(() => import("./pages/WaterQuality"));
const WaterQualityRecommendation = lazy(() => import("./pages/WaterQualityRecommendation"));
const DemandForecasting       = lazy(() => import("./pages/DemandForecasting"));
const HistoryLog              = lazy(() => import("./pages/HistoryLog"));
const Settings                = lazy(() => import("./pages/Settings"));
const Simulation              = lazy(() => import("./pages/Simulation"));
const Workspaces              = lazy(() => import("./pages/Workspaces"));
const SignIn                  = lazy(() => import("./pages/SignIn"));
const SignUp                  = lazy(() => import("./pages/SignUp"));
const Onboarding              = lazy(() => import("./pages/onboarding/Onboarding"));
const AcceptInvite            = lazy(() => import("./pages/AcceptInvite"));
const NotFound                = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Auth Guard
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

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

// Module Access Guard
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
            <Suspense 
              fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="text-lg font-medium text-cyan-600">Loading AquaNex...</div>
                </div>
              }
            >
              <Routes>
                {/* --- Public Routes --- */}
                <Route path="/"           element={<LandingPage />} />
                <Route path="/signin"     element={<SignIn />} />
                <Route path="/signup"     element={<SignUp />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/accept-invite/:token" element={<AcceptInvite />} />

                {/* --- Protected Dashboard Routes --- */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/home"       element={<Home />} />
                  <Route path="/info"       element={<InfoPage />} /> {/* ✅ Registered Route */}
                  <Route path="/workspaces" element={<Workspaces />} />
                  <Route path="/settings"   element={<Settings />} />
                  <Route path="/simulation" element={<Simulation />} />

                  {/* Pipeline Module */}
                  <Route element={<ModuleRoute module="pipeline_management" />}>
                    <Route path="/pipeline"                      element={<PipelinesManagementPage />} />
                    <Route path="/pipeline/incident/:incidentId" element={<IncidentDetails />} />
                    <Route path="/pipeline/alerts"               element={<AlertList />} />
                    <Route path="/pipeline/resources/:incidentId" element={<PipelineResources />} />
                  </Route>

                  {/* Soil Salinity Module */}
                  <Route element={<ModuleRoute module="soil_salinity" />}>
                    <Route path="/soil-salinity"                 element={<SoilSalinity />} />
                    <Route path="/soil-salinity/zone/:zoneId"    element={<ZoneDetail />} />
                  </Route>

                  {/* Analytics Module */}
                  <Route element={<ModuleRoute module="incident_analytics" />}>
                    <Route path="/incident-analytics"            element={<IncidentAnalysis />} />
                  </Route>

                  {/* Water Quality Module */}
                  <Route element={<ModuleRoute module="water_quality" />}>
                    <Route path="/water-quality"                 element={<WaterQuality />} />
                    <Route path="/water-quality/recommendation/:zoneId" element={<WaterQualityRecommendation />} />
                  </Route>

                  {/* Forecasting Module */}
                  <Route element={<ModuleRoute module="demand_forecasting" />}>
                    <Route path="/demand-forecasting"            element={<DemandForecasting />} />
                  </Route>

                  {/* History Module */}
                  <Route element={<ModuleRoute module="history_log" />}>
                    <Route path="/history"                       element={<HistoryLog />} />
                  </Route>
                </Route>

                {/* --- Redirects & Fallbacks --- */}
                <Route path="/dashboard"         element={<Navigate to="/home" replace />} />
                <Route path="/incident-analysis" element={<Navigate to="/incident-analytics" replace />} />
                <Route path="*"                  element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </SimulationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;