import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "@/components/Breadcrumbs";
import PipelineAlertCard from "@/components/PipelineAlertCard";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Polygon, useMap } from "react-leaflet";
import { useModuleDeviceSetup } from "@/hooks/useModuleDeviceSetup";
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
  const [pipelineForm, setPipelineForm] = useState({ pipe_section_id: "", pipeline_category: "", material: "", pressure_class: "", nominal_dia: "", water_capacity: "" });
  const [pipelineState, setPipelineState] = useState<"form" | "success" | "done">("form");

const handleSavePipeline = () => {
    setPipelineState("success");
    setPipelineForm({ pipe_section_id: "", pipeline_category: "", material: "", pressure_class: "", nominal_dia: "", water_capacity: "" });
  };
  const moduleSetup = useModuleDeviceSetup(["flowmeter", "pressure_sensor"]);
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
    flowmeter: "Flow Meter",
    pressure_sensor: "Pressure Sensor",
  };

  const deriveSeverity = (inc: any): string => {
    const severity = String(inc?.severity || "").toLowerCase();
    if (severity) return severity;
    const confidence = Number(inc?.details?.prediction?.confidence);
    if (Number.isFinite(confidence)) {
      if (confidence >= 0.9) return "critical";
      if (confidence >= 0.75) return "high";
      return "medium";
    }
    return "medium";
  };

  const fetchIncidents = async () => {
    try {
      const res = await api.get("/incidents/");
      const payload = res.data;
      let fetched = [];
      if (Array.isArray(payload)) {
        fetched = payload;
      } else if (Array.isArray(payload?.results)) {
        fetched = payload.results;
      } else {
        console.error("Incidents response is not an array:", payload);
        fetched = [];
      }
      
      // Ensure timestamps are GMT+4 (Asia/Dubai) for display if needed
      // But usually backend sends UTC ISO string. We can format it in render.
      setIncidents(fetched);
    } catch (err) {
      console.error("Failed to fetch incidents", err);
      setIncidents([]); 
    } finally {
    }
  };

  useEffect(() => {
    fetchIncidents();
    // Poll every 5 seconds to match simulation interval
    const interval = setInterval(fetchIncidents, 5000);
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

  const geolocatedDevices = geolocatedModuleDevices;

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

  const mappedAlerts = incidents.map((inc: any) => {
    const rawTime = inc.created_at || inc.timestamp;
    let timeStr = "N/A";
    try {
        if (rawTime) {
            timeStr = new Date(rawTime).toLocaleTimeString("en-US", { timeZone: "Asia/Dubai", hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " GMT+4";
        }
    } catch (e) {
        timeStr = "Invalid Time";
    }

    return {
        id: inc.id,
        severity: deriveSeverity(inc),
        time: timeStr,
        location: inc.location || `Gateway ${inc.gateway_id}`,
        type: inc.incident_type,
        pipeLength: "N/A",
        pipeType: "N/A",
        status: String(inc.status || "").trim().toLowerCase() || "open",
        pressure: inc.details?.pressure ? `${inc.details.pressure} bar` : undefined,
        flow: inc.details?.flow ? `${inc.details.flow} m³/h` : undefined,
    };
  });

  const sortedAlerts = [...mappedAlerts].sort((a: any, b: any) => {
     if (a.status === 'recovering' && b.status !== 'recovering') return -1;
     if (b.status === 'recovering' && a.status !== 'recovering') return 1;
     return getSeverityPriority(b.severity) - getSeverityPriority(a.severity);
  });

  const topAlerts = useMemo(
    () => sortedAlerts.slice(0, 3),
    [sortedAlerts]
  );


  if (!isConfigured) {
    return (
      <div className="p-8 space-y-6">
        <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Pipelines Management" }]} />
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Pipelines Management</h1>
          <p className="text-muted-foreground">Monitor and manage pipeline alerts and resources</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Map</CardTitle>
          </CardHeader>
          <CardContent>
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
                {geolocatedDevices.map((device: any) => (
                  <CircleMarker
                    key={device.id}
                    center={[device.lat, device.lng]}
                    radius={7}
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
              Configure required pipeline devices to continue.
            </p>
            <p className="text-sm">
              Missing:{" "}
              {missingTypes.map((type) => deviceTypeLabels[type] || type).join(", ")}
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

      {/* Top Priority Alerts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Priority Alerts</h2>
          <Button variant="ghost" className="text-primary hover:text-primary/80" onClick={() => navigate('/pipeline/alerts')}>
            View Full Alert List
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {topAlerts.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-muted-foreground bg-card rounded-xl border border-border">
              No active priority alerts
            </div>
          ) : (
            topAlerts.map((alert: any) => (
              <PipelineAlertCard
                key={alert.id}
                alert={{
                    id: alert.id,
                    location: alert.location,
                    time: alert.time,
                    severity: alert.severity,
                    type: alert.type,
                    pipeLength: alert.pipeLength,
                    pipeType: alert.pipeType,
                    status: alert.status
                }}
                onResolve={handleResolve}
              />
            ))
          )}
        </div>
      </div>
{/* Pipeline Registry */}
      {pipelineState === "form" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Pipeline Registry</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "Pipe Section ID", placeholder: "e.g. PS-001", key: "pipe_section_id" },
                  { label: "Pipeline Category", placeholder: "e.g. Main Distribution", key: "pipeline_category" },
                  { label: "Material", placeholder: "e.g. uPVC, HDPE, DI", key: "material" },
                  { label: "Pressure Class", placeholder: "e.g. PN10, PN16", key: "pressure_class" },
                  { label: "Nominal Diameter (mm)", placeholder: "e.g. 110", key: "nominal_dia" },
                  { label: "Water Capacity (m³/h)", placeholder: "e.g. 45.0", key: "water_capacity" },
                ].map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={pipelineForm[field.key as keyof typeof pipelineForm]}
                      onChange={(e) => setPipelineForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePipeline}>Save Data</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {pipelineState === "success" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 pb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <p className="text-green-700 font-medium">Pipeline section saved successfully.</p>
            </div>
            <button
              onClick={() => setPipelineState("done")}
              className="text-green-600 hover:text-green-800 text-sm font-medium"
            >
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}
    </div> 
  );
};

export default PipelinesManagementPage;
