import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "@/components/Breadcrumbs";
import PipelineAlertCard from "@/components/PipelineAlertCard";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const FitMapToPoints = ({
  points,
  fallbackZoom = 12,
  maxZoom = 16,
}: {
  points: [number, number][];
  fallbackZoom?: number;
  maxZoom?: number;
}) => {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [36, 36], maxZoom });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], Math.min(maxZoom, 15));
      return;
    }
    map.setView(DUBAI_CENTER, fallbackZoom);
  }, [fallbackZoom, map, maxZoom, points]);

  return null;
};

const PipelinesManagementPage = () => {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const res = await api.get("/incidents/");
      const payload = res.data;
      if (Array.isArray(payload)) {
        setIncidents(payload);
      } else if (Array.isArray(payload?.results)) {
        setIncidents(payload.results);
      } else {
        console.error("Incidents response is not an array:", payload);
        setIncidents([]);
      }
    } catch (err) {
      console.error("Failed to fetch incidents", err);
      setIncidents([]); // Ensure it's not undefined
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (id: string) => {
    try {
      await api.post(`/incidents/${id}/resolve/`);
      fetchIncidents();
    } catch (err) {
      console.error("Failed to resolve incident", err);
    }
  };

  const devices = Array.isArray(workspace?.devices) ? workspace.devices : [];
  const geolocatedDevices = devices.filter(
    (device: any) =>
      typeof device?.lat === "number" &&
      Number.isFinite(device.lat) &&
      typeof device?.lng === "number" &&
      Number.isFinite(device.lng)
  );

  const isPressureDevice = (device: any) =>
    String(device?.type || "").toLowerCase().includes("pressure");

  const buildDiamond = (lat: number, lng: number, size = 0.00008): [number, number][] => {
    const lngScale = Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
    const lngOffset = size / lngScale;
    return [
      [lat + size, lng],
      [lat, lng + lngOffset],
      [lat - size, lng],
      [lat, lng - lngOffset],
    ];
  };

  const inferLineOrder = (device: any): number | null => {
    const id = String(device?.id || "").toLowerCase();
    const type = String(device?.type || "").toLowerCase();
    const sensorIndexRaw = String(device?.sensor_index ?? "").trim().toLowerCase();
    const descriptor = `${id} ${type} ${sensorIndexRaw}`;

    const isFlow = type.includes("flow");
    const isPressure = type.includes("pressure");
    const index =
      /(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(descriptor)
        ? 1
        : /(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(descriptor)
        ? 2
        : null;

    if (isFlow && index === 1) return 1;
    if (isPressure && index === 1) return 2;
    if (isPressure && index === 2) return 3;
    if (isFlow && index === 2) return 4;
    return null;
  };

  const pipelineLinePositions = (() => {
    const byOrder = new Map<number, [number, number]>();
    geolocatedDevices
      .map((device: any) => ({ device, order: inferLineOrder(device) }))
      .filter((item: any) => item.order !== null)
      .sort((a: any, b: any) => a.order - b.order)
      .forEach((item: any) => {
        if (!byOrder.has(item.order)) {
          byOrder.set(item.order, [item.device.lat, item.device.lng]);
        }
      });

    return [1, 2, 3, 4]
      .map((order) => byOrder.get(order))
      .filter((pos): pos is [number, number] => Boolean(pos));
  })();

  const layoutPolygon = Array.isArray(workspace?.layout_polygon) ? workspace.layout_polygon : [];
  const mapFocusPoints = useMemo<[number, number][]>(() => {
    const fromLayout = layoutPolygon
      .map((point: any) => [point?.[1], point?.[0]] as [number, number])
      .filter(
        (point) =>
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1])
      );
    const fromDevices = geolocatedDevices.map((d: any) => [d.lat, d.lng] as [number, number]);
    return [...fromLayout, ...fromDevices];
  }, [geolocatedDevices, layoutPolygon]);

  const getSeverityPriority = (severity: string) => {
    switch (severity) {
      case "critical": return 3;
      case "high": return 2;
      case "medium": return 1;
      default: return 0;
    }
  };

  const mappedAlerts = (Array.isArray(incidents) ? incidents : []).map((inc: any) => {
    const rawTime = inc.last_seen_at || inc.detected_at;
    let timeStr = "N/A";
    try {
        if (rawTime) {
            timeStr = new Date(rawTime).toLocaleTimeString();
        }
    } catch (e) {
        timeStr = "Invalid Time";
    }

    return {
        id: inc.id,
        severity: inc.severity || "medium",
        time: timeStr,
        location: `Gateway ${inc.gateway_id}`,
        type: inc.incident_type,
        pipeLength: "N/A",
        pipeType: "N/A",
        status: inc.status
    };
  });

  const sortedAlerts = mappedAlerts.sort((a: any, b: any) => {
     if (a.status === 'recovering' && b.status !== 'recovering') return -1;
     if (b.status === 'recovering' && a.status !== 'recovering') return 1;
     return getSeverityPriority(b.severity) - getSeverityPriority(a.severity);
  });
  
  const topAlerts = sortedAlerts.slice(0, 5);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "alert";
      case "medium":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Pipelines Management" }]} />

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Pipelines Management</h1>
        <p className="text-muted-foreground">Monitor and manage pipeline alerts and resources</p>
      </div>

      {/* Map first and prominent */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Map</CardTitle>
        </CardHeader>
        <CardContent>
          {geolocatedDevices.length === 0 && layoutPolygon.length < 3 ? (
            <p className="text-sm text-muted-foreground">
              No geolocated pipeline devices or layout found. Add lat/lng to devices or upload a layout.
            </p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <MapContainer center={DUBAI_CENTER} zoom={11} style={{ height: "560px", width: "100%" }}>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles © Esri"
                />
                <FitMapToPoints points={mapFocusPoints} fallbackZoom={11} maxZoom={16} />
                {layoutPolygon.length > 2 && (
                  <Polygon
                    positions={layoutPolygon.map((point: any) => [point[1], point[0]])}
                    pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.15 }}
                  />
                )}
                {pipelineLinePositions.length > 1 && (
                  <Polyline
                    positions={pipelineLinePositions}
                    pathOptions={{ color: "#f59e0b", weight: 5, opacity: 0.95 }}
                  />
                )}
                {geolocatedDevices.map((device: any) => {
                  const sharedPopup = (
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">{device.id}</p>
                        <p>{device.type}</p>
                        <p>
                          {device.metric}: {String(device.reading)}
                        </p>
                      </div>
                    </Popup>
                  );

                  if (isPressureDevice(device)) {
                    return (
                      <Polygon
                        key={device.id}
                        positions={buildDiamond(device.lat, device.lng)}
                        pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }}
                      >
                        {sharedPopup}
                      </Polygon>
                    );
                  }

                  return (
                    <CircleMarker
                      key={device.id}
                      center={[device.lat, device.lng]}
                      radius={7}
                      pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}
                    >
                      {sharedPopup}
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Top Priority Alerts</h2>

          {loading ? (
             <p>Loading alerts...</p>
          ) : topAlerts.length === 0 ? (
             <p>No active alerts.</p>
          ) : (
            topAlerts.map((alert) => (
              <PipelineAlertCard key={alert.id} alert={alert} onResolve={handleResolve} />
            ))
          )}
        </div>

        {/* Alert Queue Summary */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Alert Queue</h2>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{incidents.length}</p>
                <p className="text-sm text-muted-foreground">Total Alerts in Queue</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/pipeline/alerts")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full Alert List
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PipelinesManagementPage;
