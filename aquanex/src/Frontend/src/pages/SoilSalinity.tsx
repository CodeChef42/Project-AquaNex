import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "@/contexts/AuthContext";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

// Helper to fit map bounds once
const FitMapToPointsOnce = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  const [fitted, setFitted] = useState(false);

  if (points.length > 2 && !fitted) {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    setFitted(true);
  }
  return null;
};

const zones = [
  { id: "A", status: "high", ec: "7.2", color: "bg-destructive" },
  { id: "B", status: "medium", ec: "4.8", color: "bg-warning" },
  { id: "C", status: "optimal", ec: "2.1", color: "bg-success" },
  { id: "D", status: "high", ec: "6.9", color: "bg-destructive" },
  { id: "E", status: "optimal", ec: "1.8", color: "bg-success" },
  { id: "F", status: "medium", ec: "5.2", color: "bg-warning" },
];

const SoilSalinity = () => {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const layoutPolygon = useMemo(() => {
    if (!workspace?.layout_polygon || workspace.layout_polygon.length < 3) return [];
    return workspace.layout_polygon.map((p: any) => [p[1], p[0]] as [number, number]);
  }, [workspace]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      default:
        return "success";
    }
  };

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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average Salinity</p>
            <p className="text-2xl font-bold text-foreground">4.5 dS/m</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Zones Needing Action</p>
            <p className="text-2xl font-bold text-destructive">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Last Mitigation</p>
            <p className="text-2xl font-bold text-foreground">3 days ago</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GIS Map */}
        <div className="lg:col-span-2">
          <Card className="h-[500px]">
            <CardHeader>
              <CardTitle>Irrigation Space Layout</CardTitle>
            </CardHeader>
            <CardContent className="h-full pb-12">
              <div className="rounded-xl border border-border overflow-hidden h-full">
                {layoutPolygon.length < 3 ? (
                  <div className="flex items-center justify-center h-full bg-muted/20 text-muted-foreground">
                    No layout polygon available.
                  </div>
                ) : (
                  <MapContainer center={DUBAI_CENTER} zoom={11} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles © Esri"
                    />
                    <FitMapToPointsOnce points={layoutPolygon} />
                    <Polygon
                      positions={layoutPolygon}
                      pathOptions={{ color: "#10b981", weight: 2, fillOpacity: 0.2 }}
                    />
                  </MapContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zone Summary Sidebar */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Zone Summary</h3>
          {zones.map((zone) => (
            <Card 
              key={zone.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/soil-salinity/zone/${zone.id}`)}
            >
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Zone {zone.id}</p>
                  <Badge variant={getStatusBadgeVariant(zone.status) as any}>
                    {zone.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-primary">{zone.ec} dS/m</p>
                <p className="text-xs text-muted-foreground">Electrical Conductivity</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SoilSalinity;
