import { useEffect, useMemo, useRef, useState } from "react";
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
  const { workspaces, workspace, fetchWorkspaces, selectWorkspace, logout, deleteWorkspace } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);


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
        name: item.workspace_name || "Untitled Workspace",
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


  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteInput("");
    try {
      await deleteWorkspace(deleteTarget.id);
    } finally {
      setDeletingId(null);
    }
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
          onClick={() => setShowLogoutConfirm(true)}
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
            const workspaceName = String(item.workspace_name || "").trim();
            const companyName = String(item.company_name || "").trim();
            const title = workspaceName || "Untitled Workspace";
            const organizationDisplay =
              companyName && companyName.toLowerCase() !== workspaceName.toLowerCase()
                ? companyName
                : "Not set";
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
                  <p className="text-slate-500">Organization: {organizationDisplay}</p>
                  <p className="text-slate-500">
                    Area: {item.layout_area_m2 ? formatArea(item.layout_area_m2) : "Not mapped"}
                  </p>
                  <p className="text-slate-500">Modules: {item.modules?.length || 0}</p>
                  <div className="pt-2 flex gap-2">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === item.id}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => { setDeleteTarget({ id: item.id, name: title }); setDeleteInput(""); }}
                    >
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Logout</h2>
            <p className="text-sm text-slate-500">Are you sure you want to log out?</p>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => { logout(); setShowLogoutConfirm(false); }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Delete Workspace</h2>
            <p className="text-sm text-slate-500">
              This action <span className="font-semibold text-red-500">cannot be undone</span>. This will permanently delete the workspace and all associated data.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-slate-700">
              Please type <span className="font-mono font-bold text-red-600">DELETE {deleteTarget.name.toUpperCase()}</span> to confirm.
            </div>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={`DELETE ${deleteTarget.name.toUpperCase()}`}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setDeleteInput(""); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteInput !== `DELETE ${deleteTarget.name.toUpperCase()}` || deletingId === deleteTarget.id}
                onClick={handleDelete}
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Delete Workspace"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default Workspaces;
