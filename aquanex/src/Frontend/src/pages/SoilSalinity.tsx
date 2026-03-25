import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import { MapContainer, TileLayer, Polygon, useMap, Tooltip, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleDeviceSetup } from "@/hooks/useModuleDeviceSetup";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

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

// ── Sutherland-Hodgman polygon clipping ──
type LatLngPoint = [number, number];

const toXY = ([lat, lng]: LatLngPoint) => ({ x: lng, y: lat });
const toLatLng = ({ x, y }: { x: number; y: number }): LatLngPoint => [y, x];

const clipPolygonWithRect = (
  polygon: LatLngPoint[],
  rect: { minX: number; maxX: number; minY: number; maxY: number }
): LatLngPoint[] => {
  if (polygon.length < 3) return [];

  const clipEdge = (
    input: Array<{ x: number; y: number }>,
    inside: (p: { x: number; y: number }) => boolean,
    intersect: (a: { x: number; y: number }, b: { x: number; y: number }) => { x: number; y: number }
  ) => {
    const output: Array<{ x: number; y: number }> = [];
    if (input.length === 0) return output;
    let prev = input[input.length - 1];
    let prevInside = inside(prev);
    for (const curr of input) {
      const currInside = inside(curr);
      if (currInside) {
        if (!prevInside) output.push(intersect(prev, curr));
        output.push(curr);
      } else if (prevInside) {
        output.push(intersect(prev, curr));
      }
      prev = curr;
      prevInside = currInside;
    }
    return output;
  };

  const intersectVertical = (xEdge: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-12) return { x: xEdge, y: a.y };
    const t = (xEdge - a.x) / dx;
    return { x: xEdge, y: a.y + t * (b.y - a.y) };
  };

  const intersectHorizontal = (yEdge: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) < 1e-12) return { x: a.x, y: yEdge };
    const t = (yEdge - a.y) / dy;
    return { x: a.x + t * (b.x - a.x), y: yEdge };
  };

  let output = polygon.map(toXY);
  output = clipEdge(output, (p) => p.x >= rect.minX, (a, b) => intersectVertical(rect.minX, a, b));
  output = clipEdge(output, (p) => p.x <= rect.maxX, (a, b) => intersectVertical(rect.maxX, a, b));
  output = clipEdge(output, (p) => p.y >= rect.minY, (a, b) => intersectHorizontal(rect.minY, a, b));
  output = clipEdge(output, (p) => p.y <= rect.maxY, (a, b) => intersectHorizontal(rect.maxY, a, b));

  const latLng = output.map(toLatLng);
  const deduped: LatLngPoint[] = [];
  for (const point of latLng) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev[0] - point[0]) > 1e-8 || Math.abs(prev[1] - point[1]) > 1e-8) {
      deduped.push(point);
    }
  }
  if (deduped.length > 1) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-8 && Math.abs(first[1] - last[1]) < 1e-8) {
      deduped.pop();
    }
  }
  return deduped.length >= 3 ? deduped : [];
};

const zones = [
  { id: "A", status: "high", ec: "7.2", color: "#ef4444" },
  { id: "B", status: "medium", ec: "4.8", color: "#f59e0b" },
  { id: "C", status: "optimal", ec: "2.1", color: "#22c55e" },
  { id: "D", status: "high", ec: "6.9", color: "#3b82f6" },
];

const SoilSalinity = () => {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const moduleSetup = useModuleDeviceSetup(["soil_salinity_sensor"]);
  const {
    gatewayIdInput,
    setGatewayIdInput,
    scanning,
    error,
    missingTypes,
    geolocatedModuleDevices,
    isConfigured,
  } = moduleSetup;
  const deviceTypeLabels: Record<string, string> = {
    soil_salinity_sensor: "Soil Salinity Sensor",
  };

  const layoutPolygon = useMemo(() => {
    if (!workspace?.layout_polygon || workspace.layout_polygon.length < 3) return [];
    return workspace.layout_polygon.map((p: any) => [p[1], p[0]] as [number, number]);
  }, [workspace]);

  const mapFocusPoints = useMemo<[number, number][]>(
    () => [...layoutPolygon, ...geolocatedModuleDevices.map((d: any) => [d.lat, d.lng] as [number, number])],
    [layoutPolygon, geolocatedModuleDevices]
  );

  const zonedLayout = useMemo(() => {
    if (layoutPolygon.length < 3) return [];
    const lats = layoutPolygon.map((p) => p[0]);
    const lngs = layoutPolygon.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;

    const zoneRects = [
      { label: "Zone A", color: "#ef4444", rect: { minX: minLng, maxX: midLng, minY: midLat, maxY: maxLat } },
      { label: "Zone B", color: "#f59e0b", rect: { minX: midLng, maxX: maxLng, minY: midLat, maxY: maxLat } },
      { label: "Zone C", color: "#22c55e", rect: { minX: minLng, maxX: midLng, minY: minLat, maxY: midLat } },
      { label: "Zone D", color: "#3b82f6", rect: { minX: midLng, maxX: maxLng, minY: minLat, maxY: midLat } },
    ];

    return zoneRects
      .map((zone) => ({
        ...zone,
        polygon: clipPolygonWithRect(layoutPolygon, zone.rect),
      }))
      .filter((zone) => zone.polygon.length >= 3);
  }, [layoutPolygon]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "high": return "destructive";
      case "medium": return "warning";
      default: return "success";
    }
  };

  if (!isConfigured) {
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
        <Card className="h-[500px]">
          <CardHeader>
            <CardTitle>Map View</CardTitle>
            <CardDescription>Default layout and configured device coordinates</CardDescription>
          </CardHeader>
          <CardContent className="h-full pb-12">
            <div className="rounded-xl border border-border overflow-hidden h-full">
              <MapContainer center={DUBAI_CENTER} zoom={11} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles © Esri"
                />
                <FitMapToPointsOnce points={mapFocusPoints} />
                {layoutPolygon.length >= 3 && (
                  <Polygon
                    positions={layoutPolygon}
                    pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.15 }}
                  />
                )}
                {geolocatedModuleDevices.map((device: any) => (
                  <CircleMarker
                    key={device.id}
                    center={[device.lat, device.lng]}
                    radius={6}
                    pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">{device.id}</p>
                        <p>{device.type}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Devices Not Configured</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure required soil salinity devices to continue.
            </p>
            <p className="text-sm">
              Missing: {missingTypes.map((type) => deviceTypeLabels[type] || type).join(", ")}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={gatewayIdInput}
                onChange={(event) => setGatewayIdInput(event.target.value)}
                placeholder="Gateway ID"
                className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <Button onClick={moduleSetup.scanAndConfigure} disabled={scanning}>
                {scanning ? "Scanning..." : "Configure Devices"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <CardTitle>Map View</CardTitle>
              <CardDescription>Real-time salinity heatmap by zone</CardDescription>
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
                    <FitMapToPointsOnce points={mapFocusPoints} />

                    {/* Clipped zone polygons */}
                    {zonedLayout.length > 0 ? (
                      zonedLayout.map((zone) => (
                        <Polygon
                          key={zone.label}
                          positions={zone.polygon}
                          pathOptions={{ color: zone.color, weight: 2, fillOpacity: 0.4 }}
                        >
                          <Tooltip sticky>{zone.label}</Tooltip>
                        </Polygon>
                      ))
                    ) : (
                      <Polygon
                        positions={layoutPolygon}
                        pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.15 }}
                      />
                    )}

                    {/* Outline the main layout */}
                    <Polygon
                      positions={layoutPolygon}
                      pathOptions={{ color: "white", weight: 2, fillOpacity: 0, dashArray: "5, 5" }}
                    />

                    {geolocatedModuleDevices.map((device: any) => (
                      <CircleMarker
                        key={device.id}
                        center={[device.lat, device.lng]}
                        radius={6}
                        pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}
                      >
                        <Popup>
                          <div className="text-xs space-y-1">
                            <p className="font-semibold">{device.id}</p>
                            <p>{device.type}</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
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