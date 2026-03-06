import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Filter, Loader2, Map as MapIcon, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";

// Lazy load map to avoid SSR/bundle issues
const SoilMap = lazy(() => import("@/components/soil/SoilMap"));

interface SoilZone {
  id: string;
  name: string;
  boundary: any;
  area_ha: number;
  soil_texture: string;
  ec_threshold: number;
  latest_ec: number | null;
  sensor_count: number;
  created_at: string;
}

const SoilSalinity = () => {
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const { data: zones, isLoading, error } = useQuery<SoilZone[]>({
    queryKey: ["soil-zones"],
    queryFn: async () => {
      const response = await api.get("/soil/zones/");
      return response.data;
    },
  });

  const getStatusBadgeVariant = (ec: number | null, threshold: number) => {
    if (ec === null) return "secondary";
    if (ec >= threshold * 1.5) return "destructive";
    if (ec >= threshold) return "warning";
    return "success";
  };

  const getStatusText = (ec: number | null, threshold: number) => {
    if (ec === null) return "NO DATA";
    if (ec >= threshold * 1.5) return "CRITICAL";
    if (ec >= threshold) return "WARNING";
    return "OPTIMAL";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading soil zones. Please try again later.
      </div>
    );
  }

  const isEmpty = !isLoading && (!zones || zones.length === 0);

  const avgSalinity = zones?.length 
    ? (zones.reduce((acc, z) => acc + (z.latest_ec || 0), 0) / zones.length).toFixed(1)
    : "0.0";

  const zonesNeedingAction = zones?.filter(z => (z.latest_ec || 0) >= z.ec_threshold).length || 0;

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Soil Salinity" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Soil Intelligence Console</h1>
          <p className="text-muted-foreground">Monitor and manage soil salinity across all zones</p>
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Metrics Row - Only show when there are zones */}
      {!isEmpty && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Average Salinity</p>
              <p className="text-2xl font-bold text-foreground">{avgSalinity} dS/m</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Zones Needing Action</p>
              <p className="text-2xl font-bold text-destructive">{zonesNeedingAction}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Managed Area</p>
              <p className="text-2xl font-bold text-foreground">
                {zones?.reduce((acc, z) => acc + z.area_ha, 0).toFixed(1)} ha
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GIS Map Overlay */}
        <div className="lg:col-span-2">
          <Card className="h-[500px] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-md flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-primary" />
                {isEmpty ? "No Zones Configured" : "Zone Spatial Distribution"}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[420px] p-0 relative">
              {isEmpty ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                  <Info className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-foreground">No soil zones have been configured</p>
                  <p className="text-sm text-muted-foreground mt-1">Add your first zone to start monitoring soil salinity</p>
                </div>
              ) : (
                <>
                  <Suspense fallback={
                    <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Initializing GIS Layer...</p>
                    </div>
                  }>
                    <SoilMap 
                      zones={zones || []} 
                      onZoneClick={(id) => navigate(`/soil-salinity/zone/${id}`)}
                    />
                  </Suspense>

                  {/* Map Floating Legend */}
                  <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border z-[1000]">
                    <p className="text-[10px] font-bold mb-2 uppercase tracking-wider text-muted-foreground">Status Legend</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-destructive rounded-full" />
                        <span className="text-[9px] font-medium">Critical (&gt;Thr x 1.5)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-warning rounded-full" />
                        <span className="text-[9px] font-medium">Warning (&gt;Threshold)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-success rounded-full" />
                        <span className="text-[9px] font-medium">Optimal</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Zone List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Zone Summary
            <Badge variant="outline" className="ml-auto">{zones?.length || 0}</Badge>
          </h3>
          {isEmpty ? (
            <Card className="p-8">
              <div className="text-center space-y-3">
                <MapPin className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No zones available</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/onboarding')}>
                  Configure in Onboarding
                </Button>
              </div>
            </Card>
          ) : (
            <div className="overflow-y-auto max-h-[420px] pr-2 space-y-3 scrollbar-thin">
            {zones?.map((zone) => (
              <Card 
                key={zone.id}
                className={`cursor-pointer transition-all border-l-4 ${
                  (zone.latest_ec || 0) >= zone.ec_threshold * 1.5 ? 'border-l-destructive' :
                  (zone.latest_ec || 0) >= zone.ec_threshold ? 'border-l-warning' : 'border-l-success'
                } hover:shadow-md`}
                onClick={() => navigate(`/soil-salinity/zone/${zone.id}`)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">{zone.name}</p>
                    <Badge variant={getStatusBadgeVariant(zone.latest_ec, zone.ec_threshold) as any} className="text-[10px] h-5 px-1.5">
                      {getStatusText(zone.latest_ec, zone.ec_threshold)}
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-black text-primary">{zone.latest_ec?.toFixed(1) || "---"}</p>
                    <span className="text-[10px] text-muted-foreground font-medium">dS/m</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {zone.area_ha} ha</span>
                    <span>{zone.sensor_count} Sensors</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoilSalinity;
