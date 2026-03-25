import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { divIcon } from "leaflet";
import Logo from "@/components/Logo";


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
    if (points.length === 0) { map.setView(DUBAI_CENTER, 10); return; }
    if (points.length === 1) { map.setView(points[0], 14); hasInitializedRef.current = true; return; }
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

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const polygons = useMemo(() =>
    workspaces.map((item) => {
      const polygon = Array.isArray(item.layout_polygon) ? item.layout_polygon : [];
      if (polygon.length < 3) return null;
      return {
        id: item.id,
        name: item.workspace_name || item.company_name || "Untitled Workspace",
        area: item.layout_area_m2 || 0,
        positions: polygon.map(([lng, lat]) => [lat, lng] as [number, number]),
      };
    }).filter((item): item is { id: string; name: string; area: number; positions: [number, number][] } => Boolean(item)),
    [workspaces]
  );

  const mapPoints = useMemo<[number, number][]>(() =>
    polygons.flatMap((item) => item.positions), [polygons]
  );

  const mapPins = useMemo(() =>
    polygons.map((item) => {
      if (item.positions.length === 0) return null;
      const sums = item.positions.reduce(
        (acc, [lat, lng]) => { acc.lat += lat; acc.lng += lng; return acc; },
        { lat: 0, lng: 0 }
      );
      return {
        id: item.id,
        name: item.name,
        position: [sums.lat / item.positions.length, sums.lng / item.positions.length] as [number, number],
      };
    }).filter((pin): pin is { id: string; name: string; position: [number, number] } => Boolean(pin)),
    [polygons]
  );

  const handleOpenWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    navigate("/home");
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <header
        className="h-20 border-b border-cyan-200/60 flex items-center justify-between px-6 shrink-0 backdrop-blur-md"
        style={{ background: "rgba(255,255,255,0.5)" }}
      >
        <Logo withText={true} size="md" />
        <Button
          variant="ghost"
          onClick={() => logout()}
          className="text-slate-500 hover:text-red-500 hover:bg-red-50 gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </header>

      {/* Page content */}
      <div className="flex-1 p-6 space-y-6 max-w-screen-2xl mx-auto w-full">

        <div>
          <h1 className="text-2xl font-bold text-slate-800">Workspaces</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor all irrigation spaces and switch workspace context.
          </p>
        </div>

        <Card className="bg-white/70 backdrop-blur-sm border-cyan-100">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-slate-700">
              All Irrigation Spaces Map
            </CardTitle>
            <Button
              onClick={() => navigate("/onboarding?new=1")}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Create New Workspace
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-xl border border-cyan-100 overflow-hidden">
              <MapContainer center={DUBAI_CENTER} zoom={10} style={{ height: "460px", width: "100%" }}>
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
              <Card
                key={item.id}
                className={`bg-white/70 backdrop-blur-sm border-cyan-100 ${isActive ? "border-l-4 border-l-teal-500" : ""}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-700">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <p className="text-slate-500">Organization: {item.company_name || "—"}</p>
                  <p className="text-slate-500">
                    Area: {item.layout_area_m2 ? formatArea(item.layout_area_m2) : "Not mapped"}
                  </p>
                  <p className="text-slate-500">Modules: {item.modules?.length || 0}</p>
                  <div className="pt-2">
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={
                        isActive
                          ? "bg-teal-600 hover:bg-teal-700 text-white"
                          : "border-cyan-200 text-slate-700 bg-white/70 hover:bg-slate-700 hover:text-white hover:border-slate-700 transition-colors"
                      }
                      onClick={() => handleOpenWorkspace(item.id)}
                    >
                      {isActive ? "Active Workspace" : "Open Workspace"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
};


export default Workspaces;
