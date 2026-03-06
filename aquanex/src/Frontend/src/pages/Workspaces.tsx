import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { divIcon } from "leaflet";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];
const workspacePinIcon = divIcon({
  html: '<div style="font-size:30px;line-height:30px;">📍</div>',
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const FitMapToPoints = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (points.length === 0) {
      map.setView(DUBAI_CENTER, 10);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 14);
      hasInitializedRef.current = true;
      return;
    }
    map.fitBounds(points, { padding: [42, 42], maxZoom: 15 });
    hasInitializedRef.current = true;
  }, [map, points]);

  return null;
};

const Workspaces = () => {
  const navigate = useNavigate();
  const { workspaces, workspace, fetchWorkspaces, selectWorkspace, logout } = useAuth();
  const formatArea = (areaM2: number) => {
    const area = Number.isFinite(areaM2) ? Math.max(0, areaM2) : 0;
    if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
    if (area >= 10_000) return `${(area / 10_000).toFixed(2)} ha`;
    return `${Math.round(area).toLocaleString()} m²`;
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const polygons = useMemo(
    () =>
      workspaces
        .map((item) => {
          const polygon = Array.isArray(item.layout_polygon) ? item.layout_polygon : [];
          if (polygon.length < 3) return null;
          return {
            id: item.id,
            name: item.workspace_name || item.company_name || "Untitled Workspace",
            area: item.layout_area_m2 || 0,
            positions: polygon.map(([lng, lat]) => [lat, lng] as [number, number]),
          };
        })
        .filter((item): item is { id: string; name: string; area: number; positions: [number, number][] } => Boolean(item)),
    [workspaces]
  );

  const mapPoints = useMemo<[number, number][]>(() => {
    return polygons.flatMap((item) => item.positions);
  }, [polygons]);

  const mapPins = useMemo(
    () =>
      polygons
        .map((item) => {
          if (item.positions.length === 0) return null;
          const sums = item.positions.reduce(
            (acc, [lat, lng]) => {
              acc.lat += lat;
              acc.lng += lng;
              return acc;
            },
            { lat: 0, lng: 0 }
          );
          const center: [number, number] = [
            sums.lat / item.positions.length,
            sums.lng / item.positions.length,
          ];
          return {
            id: item.id,
            name: item.name,
            position: center,
          };
        })
        .filter((pin): pin is { id: string; name: string; position: [number, number] } => Boolean(pin)),
    [polygons]
  );

  const handleOpenWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    navigate("/home");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor all irrigation spaces and switch workspace context.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
          <Button onClick={() => navigate("/onboarding?new=1")}>Create New Workspace</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Irrigation Spaces Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border overflow-hidden">
            <MapContainer center={DUBAI_CENTER} zoom={10} style={{ height: "500px", width: "100%" }}>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri"
              />
              <FitMapToPoints points={mapPoints} />
              {polygons.map((item) => (
                <Polygon
                  key={item.id}
                  positions={item.positions}
                  pathOptions={{
                    color: workspace?.id === item.id ? "#2563eb" : "#0ea5e9",
                    weight: workspace?.id === item.id ? 4 : 2,
                    fillOpacity: workspace?.id === item.id ? 0.25 : 0.15,
                  }}
                />
              ))}
              {mapPins.map((pin) => (
                <Marker key={pin.id} position={pin.position} icon={workspacePinIcon}>
                  <Popup>{pin.name}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {workspaces.map((item) => {
          const title = item.workspace_name || item.company_name || "Untitled Workspace";
          const isActive = workspace?.id === item.id;
          return (
            <Card key={item.id} className={isActive ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">Organization: {item.company_name || "—"}</p>
                <p className="text-muted-foreground">
                  Area: {item.layout_area_m2 ? formatArea(item.layout_area_m2) : "Not mapped"}
                </p>
                <p className="text-muted-foreground">Modules: {item.modules?.length || 0}</p>
                <div className="pt-2">
                  <Button variant={isActive ? "default" : "outline"} onClick={() => handleOpenWorkspace(item.id)}>
                    {isActive ? "Active Workspace" : "Open Workspace"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Workspaces;
