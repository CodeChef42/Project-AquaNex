import { AlertTriangle, Droplet, TrendingDown, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const alertData = [
  { day: "Mon", count: 12 },
  { day: "Tue", count: 19 },
  { day: "Wed", count: 15 },
  { day: "Thu", count: 22 },
  { day: "Fri", count: 18 },
  { day: "Sat", count: 14 },
  { day: "Sun", count: 16 },
];

// Mock data for live issues feed - replace with API call later
const recentIssues = [
  { id: 1, title: "Pipeline Leak Detected in Zone A", timestamp: "2 hours ago", severity: "High", link: "/pipeline/incident/1" },
  { id: 2, title: "Water Quality Alert - pH Levels", timestamp: "4 hours ago", severity: "Medium", link: "/water-quality" },
  { id: 3, title: "Soil Salinity Exceeded Threshold", timestamp: "6 hours ago", severity: "Low", link: "/soil-salinity" },
  { id: 4, title: "Incident in Demand Forecasting", timestamp: "8 hours ago", severity: "Medium", link: "/incident-analytics" },
  { id: 5, title: "Maintenance Required on Pipe ID-123", timestamp: "12 hours ago", severity: "Low", link: "/pipeline" },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, workspace, fetchWorkspace } = useAuth();
  
  const userName = user?.full_name || user?.username || "User";
  const layoutPolygon = Array.isArray(workspace?.layout_polygon)
    ? workspace.layout_polygon
    : [];
  const layoutCenter =
    layoutPolygon.length > 0
      ? [layoutPolygon[0][1], layoutPolygon[0][0]]
      : [25.2048, 55.2708];
  const workspaceDevices = Array.isArray(workspace?.devices) ? workspace.devices : [];
  const geolocatedDevices = workspaceDevices.filter(
    (device) =>
      typeof device?.lat === "number" &&
      Number.isFinite(device.lat) &&
      typeof device?.lng === "number" &&
      Number.isFinite(device.lng)
  );
  const mapCenter =
    geolocatedDevices.length > 0
      ? [geolocatedDevices[0].lat as number, geolocatedDevices[0].lng as number]
      : layoutCenter;

  useEffect(() => {
    fetchWorkspace();
    const timer = window.setInterval(() => {
      fetchWorkspace();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [fetchWorkspace]);

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {userName}</h1>
          <p className="text-muted-foreground">System Overview - Here's what's happening with your irrigation system today</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-destructive/20 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/pipeline")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">14</div>
            <p className="text-xs text-muted-foreground mt-1">Critical/High priority alerts</p>
            <Button variant="link" className="px-0 mt-2 text-destructive hover:text-destructive/80">
              View Pipeline Management →
            </Button>
          </CardContent>
        </Card>

        <Card className="border-warning/20 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/soil-salinity")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Zones Needing Action</CardTitle>
            <Droplet className="w-5 h-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">8</div>
            <p className="text-xs text-muted-foreground mt-1">High salinity zones</p>
            <Button variant="link" className="px-0 mt-2 text-warning hover:text-warning/80">
              View Soil Salinity →
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/anomaly-analysis")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quarterly Water Loss</CardTitle>
            <TrendingDown className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">AED 2.4M</div>
            <p className="text-xs text-success mt-1">↓ 8% from last quarter</p>
            <Button variant="link" className="px-0 mt-2 text-primary hover:text-primary/80">
              View Incident Analytics →
            </Button>
          </CardContent>
        </Card>
      </div>

      {layoutPolygon.length >= 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved Onboarding Layout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border overflow-hidden">
              <MapContainer
                center={mapCenter as [number, number]}
                zoom={16}
                style={{ height: "280px", width: "100%" }}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri"
                />
                <Polygon
                  positions={layoutPolygon.map(([lng, lat]) => [lat, lng])}
                  pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.25 }}
                />
                {geolocatedDevices.map((device) => (
                  <CircleMarker
                    key={device.id}
                    center={[device.lat as number, device.lng as number]}
                    radius={6}
                    pathOptions={{
                      color: device.anomaly
                        ? "#dc2626"
                        : device.type === "pressure_sensor"
                        ? "#f59e0b"
                        : "#ef4444",
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">{device.id}</p>
                        <p>{device.type}</p>
                        <p>
                          {device.metric}: {String(device.reading)}
                        </p>
                        {device.anomaly && (
                          <p className="text-red-600 font-semibold">
                            Anomaly: {device.anomaly_meta?.reason || "delta spike"}
                          </p>
                        )}
                        <p className="text-muted-foreground">{device.last_seen}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            <p className="text-xs text-muted-foreground">
              Area: {workspace?.layout_area_m2 ? `${(workspace.layout_area_m2 / 1000).toFixed(2)}k m²` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Devices on map: {geolocatedDevices.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Active anomalies: {geolocatedDevices.filter((d) => d.anomaly).length}
            </p>
            {workspace?.layout_notes && (
              <p className="text-xs text-muted-foreground">
                Notes: {workspace.layout_notes}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Saved Onboarding Layout</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No confirmed layout saved yet. Complete Step 4 and confirm layout in onboarding.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Platform-Wide Alerts Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Platform-Wide Alerts (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={alertData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)"
                }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Live Issues Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Live Issues Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentIssues.map((issue) => (
            <div key={issue.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex-1">
                <h4 className="font-medium">{issue.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{issue.timestamp}</span>
                  <Badge variant={issue.severity === "High" ? "destructive" : issue.severity === "Medium" ? "default" : "secondary"}>
                    {issue.severity}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(issue.link)}>
                View Details
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
