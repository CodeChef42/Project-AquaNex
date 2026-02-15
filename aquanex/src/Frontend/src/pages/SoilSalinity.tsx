import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";

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
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

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
              <CardTitle>Zone Map</CardTitle>
            </CardHeader>
            <CardContent className="h-full pb-12">
              <div className="relative w-full h-full bg-muted rounded-lg overflow-hidden">
                {/* Simplified map grid */}
                <div className="absolute inset-4 grid grid-cols-3 gap-4">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`${zone.color} rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-all transform hover:scale-105`}
                      onClick={() => {
                        setSelectedZone(zone.id);
                        navigate(`/soil-salinity/zone/${zone.id}`);
                      }}
                    >
                      <div className="text-center text-white">
                        <MapPin className="w-8 h-8 mx-auto mb-2" />
                        <p className="font-bold text-xl">Zone {zone.id}</p>
                        <p className="text-sm">{zone.ec} dS/m</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-card p-3 rounded-lg shadow-lg">
                  <p className="text-xs font-semibold mb-2">Legend</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-destructive rounded" />
                      <span className="text-xs">High Salinity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-warning rounded" />
                      <span className="text-xs">Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-success rounded" />
                      <span className="text-xs">Optimal</span>
                    </div>
                  </div>
                </div>
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
