import { AlertTriangle, Droplet, TrendingDown, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "@/lib/api";
import { MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const HOME_FALLBACK_CENTER: [number, number] = [25.2048, 55.2708];

const FitMapToPoints = ({ points }: { points: [number, number][] }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(HOME_FALLBACK_CENTER, 13);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
  }, [map, points]);

  return null;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, workspace, fetchWorkspace } = useAuth();
  const [recentIssues, setRecentIssues] = useState<any[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [totalRepairHours, setTotalRepairHours] = useState(0);
  
  const userName = user?.full_name || user?.username || "User";
  const layoutPolygon = Array.isArray(workspace?.layout_polygon)
    ? workspace.layout_polygon
    : [];
  const mapFocusPoints = useMemo<[number, number][]>(() => {
    return layoutPolygon
      .map(([lng, lat]) => [lat, lng] as [number, number])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }, [layoutPolygon]);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await api.get("/incidents/");
        const payload = response.data;
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
        
        // Total Alerts
        setTotalAlerts(rows.length);

        // Calculate Total Repair Hours
        // Assuming 'repair_time_hours' or estimating based on status/duration
        // For now, we simulate this calculation based on severity weights if actual data is missing
        const hours = rows.reduce((acc: number, inc: any) => {
            const duration = inc.repair_duration_hours || (
                inc.severity === 'critical' ? 8 : 
                inc.severity === 'high' ? 4 : 
                inc.severity === 'medium' ? 2 : 1
            );
            return acc + duration;
        }, 0);
        setTotalRepairHours(Math.round(hours));

        const mapped = rows
          .slice()
          .sort((a: any, b: any) => {
            const tA = new Date(a.last_seen_at || a.detected_at || a.created_at || 0).getTime();
            const tB = new Date(b.last_seen_at || b.detected_at || b.created_at || 0).getTime();
            return tB - tA;
          })
          .slice(0, 8)
          .map((inc: any, idx: number) => {
            const rawTs = inc.last_seen_at || inc.detected_at || inc.created_at;
            const ts = rawTs ? new Date(rawTs) : null;
            const severity = String(inc.severity || "medium").toLowerCase();
            return {
              key: `${inc.id || idx}-${inc.gateway_id || "gw"}-${inc.incident_type || "incident"}`,
              title: `Alert: ${String(inc.incident_type || "incident").replace(/_/g, " ")}`,
              timestamp: ts && !Number.isNaN(ts.getTime())
                ? ts.toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Just now",
              severity:
                severity === "critical"
                  ? "High"
                  : severity === "high"
                  ? "High"
                  : severity === "low"
                  ? "Low"
                  : "Medium",
              link: "/pipeline/alerts",
            };
          });

        setRecentIssues(mapped);
      } catch (error) {
        console.error("Failed to fetch incidents for home feed", error);
        setRecentIssues([]);
      }
    };

    fetchWorkspace();
    fetchIncidents();
    const timer = window.setInterval(() => {
      fetchWorkspace();
      fetchIncidents();
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
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{totalAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending incidents in database</p>
            <Button variant="link" className="px-0 mt-2 text-destructive hover:text-destructive/80">
              View Pipeline Management →
            </Button>
          </CardContent>
        </Card>

        <Card className="border-warning/20 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/soil-salinity")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Est. Repair Hours</CardTitle>
            <Clock className="w-5 h-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{totalRepairHours}h</div>
            <p className="text-xs text-muted-foreground mt-1">Total estimated resolution time</p>
            <Button variant="link" className="px-0 mt-2 text-warning hover:text-warning/80">
              View Analytics Engine →
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
                center={HOME_FALLBACK_CENTER}
                zoom={13}
                style={{ height: "460px", width: "100%" }}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri"
                />
                <FitMapToPoints points={mapFocusPoints} />
                <Polygon
                  positions={layoutPolygon.map(([lng, lat]) => [lat, lng])}
                  pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.25 }}
                />
              </MapContainer>
            </div>
            <p className="text-xs text-muted-foreground">
              Area: {workspace?.layout_area_m2 ? `${(workspace.layout_area_m2 / 1000).toFixed(2)}k m²` : "—"}
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

      {/* Live Issues Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Live Issues Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live alerts at the moment.</p>
          ) : (
          recentIssues.map((issue) => (
            <div key={issue.key} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
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
          )))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
