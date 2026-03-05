import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Polygon, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const Workspaces = () => {
  const navigate = useNavigate();
  const { workspaces, workspace, fetchWorkspaces, selectWorkspace } = useAuth();

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

  const mapCenter = useMemo<[number, number]>(() => {
    if (polygons.length === 0) return DUBAI_CENTER;
    return polygons[0].positions[0] || DUBAI_CENTER;
  }, [polygons]);

  const handleOpenWorkspace = async (workspaceId: string) => {
    await selectWorkspace(workspaceId);
    navigate("/home");
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
        <Button onClick={() => navigate("/onboarding?new=1")}>Create New Workspace</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Irrigation Spaces Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border overflow-hidden">
            <MapContainer center={mapCenter} zoom={10} style={{ height: "420px", width: "100%" }}>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri"
              />
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
                  Area: {item.layout_area_m2 ? `${(item.layout_area_m2 / 1000).toFixed(2)}k m²` : "Not mapped"}
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
