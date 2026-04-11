import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Droplet, Activity, RefreshCw, XCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MapContainer, Polygon, TileLayer, useMap, CircleMarker, Popup } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { useModuleDeviceSetup } from "@/hooks/useModuleDeviceSetup";
import api from "@/lib/api";
import "leaflet/dist/leaflet.css";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];
const POLL_INTERVAL_MS = 5_000;

// ─── types ──────────────────────────────────────────────────────────────────

interface WqSensor {
  device_id: string;
  device_type: "ph_sensor" | "turbidity_sensor";
  metric: string;
  value: number | null;
  ts: string;
  lat: number | null;
  lng: number | null;
  mcu_id: string;
  status: string;
}

interface WqAlert {
  id: string;
  incident_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  device_id: string;
  detected_at: string | null;
  last_seen_at: string | null;
  details: Record<string, any>;
}

interface WqReadings {
  gateway_id: string;
  sensors: WqSensor[];
  alerts: WqAlert[];
}

// ─── thresholds ──────────────────────────────────────────────────────────────

const PH_OPTIMAL: [number, number] = [6.5, 7.5];
const PH_WARNING: [number, number] = [6.0, 8.0];
const TURB_OPTIMAL = 3.0; // NTU
const TURB_WARNING = 5.0;

function phStatus(v: number): "optimal" | "warning" | "critical" {
  if (v >= PH_OPTIMAL[0] && v <= PH_OPTIMAL[1]) return "optimal";
  if (v >= PH_WARNING[0] && v <= PH_WARNING[1]) return "warning";
  return "critical";
}

function turbStatus(v: number): "optimal" | "warning" | "critical" {
  if (v <= TURB_OPTIMAL) return "optimal";
  if (v <= TURB_WARNING) return "warning";
  return "critical";
}

function sensorStatus(sensor: WqSensor): "optimal" | "warning" | "critical" | "unknown" {
  if (sensor.value === null || sensor.value === undefined) return "unknown";
  if (sensor.device_type === "ph_sensor") return phStatus(sensor.value);
  if (sensor.device_type === "turbidity_sensor") return turbStatus(sensor.value);
  return "unknown";
}

// ─── map helper ──────────────────────────────────────────────────────────────

const FitMapToPointsOnce = ({
  points,
  fallbackCenter = DUBAI_CENTER,
  fallbackZoom = 12,
  maxZoom = 16,
}: {
  points: [number, number][];
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
  maxZoom?: number;
}) => {
  const map = useMap();
  const lastKeyRef = useRef<string>("");
  const key = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join("|");

  useEffect(() => {
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    if (points.length === 0) { map.setView(fallbackCenter, fallbackZoom); return; }
    if (points.length === 1) { map.setView(points[0], Math.min(maxZoom, 15)); return; }
    map.fitBounds(points, { padding: [42, 42], maxZoom });
  }, [fallbackCenter, fallbackZoom, key, map, maxZoom, points]);

  return null;
};

// ─── colour helpers ──────────────────────────────────────────────────────────

function statusBg(s: string) {
  if (s === "optimal") return "bg-green-100 text-green-800 border-green-300";
  if (s === "warning") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (s === "critical") return "bg-red-100 text-red-800 border-red-300";
  return "bg-gray-100 text-gray-800 border-gray-300";
}

function severityBg(s: string) {
  if (s === "critical") return "bg-red-100 text-red-800 border-red-300";
  if (s === "high") return "bg-orange-100 text-orange-800 border-orange-300";
  if (s === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-blue-100 text-blue-800 border-blue-300";
}

function markerColor(s: string) {
  if (s === "critical") return "#ef4444";
  if (s === "warning") return "#f59e0b";
  return "#22c55e";
}

function incidentLabel(type: string) {
  const map: Record<string, string> = {
    ph_warning: "pH Warning",
    ph_anomaly: "pH Anomaly",
    ph_critical: "pH Critical",
    turbidity_warning: "Turbidity Warning",
    turbidity_spike: "Turbidity Spike",
    turbidity_critical: "Turbidity Critical",
  };
  return map[type] || type.replace(/_/g, " ");
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

// ─── main component ──────────────────────────────────────────────────────────

const WaterQualityMonitoring = () => {
  const { workspace } = useAuth();
  const navigate = useNavigate();

  const moduleSetup = useModuleDeviceSetup(["ph_sensor", "turbidity_sensor"]);
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
    ph_sensor: "pH Sensor",
    turbidity_sensor: "Turbidity Sensor",
  };

  // Live readings state
  const [readings, setReadings] = useState<WqReadings | null>(null);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchReadings = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const res = await api.get("/water-quality/readings/");
      console.debug("[WQ] readings response:", res.data);
      setReadings(res.data as WqReadings);
      setLastFetched(new Date());
    } catch (err: any) {
      console.error("[WQ] readings fetch failed:", err?.response?.data || err?.message);
      // keep stale data
    } finally {
      setLoadingReadings(false);
    }
  }, [isConfigured]);

  // Initial load + polling
  useEffect(() => {
    if (!isConfigured) return;
    setLoadingReadings(true);
    fetchReadings();
    const id = setInterval(fetchReadings, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isConfigured, fetchReadings]);

  // Map polygon
  const layoutPolygon = Array.isArray((workspace as any)?.layout_polygon)
    ? ((workspace as any).layout_polygon as any[])
    : [];
  const layoutLatLng = useMemo<[number, number][]>(() => {
    return layoutPolygon
      .map((p: any) => [Number(p?.[1]), Number(p?.[0])] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }, [layoutPolygon]);

  // Merge geolocated devices from workspace with live readings for map markers
  const mapSensors = useMemo(() => {
    const liveById: Record<string, WqSensor> = {};
    (readings?.sensors || []).forEach((s) => { liveById[s.device_id] = s; });

    return geolocatedModuleDevices.map((d: any) => {
      const live = liveById[d.id];
      const st = live ? sensorStatus(live) : "unknown";
      return { ...d, liveStatus: st, liveValue: live?.value, liveMetric: live?.metric };
    });
  }, [geolocatedModuleDevices, readings]);

  const mapFocusPoints = useMemo<[number, number][]>(
    () => [
      ...layoutLatLng,
      ...mapSensors
        .filter((d) => typeof d.lat === "number" && typeof d.lng === "number")
        .map((d) => [d.lat, d.lng] as [number, number]),
    ],
    [layoutLatLng, mapSensors]
  );

  // Summary counts
  const sensors = readings?.sensors ?? [];
  const alerts = readings?.alerts ?? [];

  const sensorsWithReadings = sensors.filter((s) => s.value !== null && s.value !== undefined);
  const optimal  = sensorsWithReadings.filter((s) => sensorStatus(s) === "optimal").length;
  const warning  = sensorsWithReadings.filter((s) => sensorStatus(s) === "warning").length;
  const critical = sensorsWithReadings.filter((s) => sensorStatus(s) === "critical").length;

  const activeAlerts = alerts.filter((a) => a.status === "ongoing" || a.status === "open");

  // True all-clear: has readings, none are warning/critical, and no active alerts
  const allClear = sensorsWithReadings.length > 0 && warning === 0 && critical === 0 && activeAlerts.length === 0;

  // ── not configured view ────────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="container mx-auto px-6 py-8">
            <nav className="text-sm text-gray-500 mb-4">
              <a href="/" className="hover:text-teal-600">Home</a>
              <span className="mx-2">›</span>
              <span className="text-gray-900">Water Quality</span>
            </nav>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Water Quality Monitoring</h1>
            <p className="text-gray-600">Real-time water quality analysis and management</p>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-teal-600" />
                Irrigation Space Layout
              </CardTitle>
              <CardDescription>Default layout and configured device coordinates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border overflow-hidden">
                <MapContainer center={DUBAI_CENTER} zoom={12} style={{ height: "360px", width: "100%" }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                  <FitMapToPointsOnce points={mapFocusPoints} fallbackZoom={12} maxZoom={16} />
                  {layoutLatLng.length >= 3 && (
                    <Polygon positions={layoutLatLng} pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.2 }} />
                  )}
                  {mapSensors.map((device: any) => (
                    <CircleMarker key={device.id} center={[device.lat, device.lng]} radius={6}
                      pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}>
                      <Popup><div className="text-xs space-y-1"><p className="font-semibold">{device.id}</p><p>{device.type}</p></div></Popup>
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
              <p className="text-sm text-muted-foreground">Configure required water quality devices to continue.</p>
              <p className="text-sm">
                Missing:{" "}
                <span className="font-medium">{missingTypes.map((t) => deviceTypeLabels[t] || t).join(", ")}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={gatewayIdInput}
                  onChange={(e) => setGatewayIdInput(e.target.value)}
                  placeholder="Gateway ID (e.g. WQ-GATEWAY-01)"
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
      </div>
    );
  }

  // ── configured view ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-8">
          <nav className="text-sm text-gray-500 mb-4">
            <a href="/" className="hover:text-teal-600">Home</a>
            <span className="mx-2">›</span>
            <span className="text-gray-900">Water Quality</span>
          </nav>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Water Quality Monitoring</h1>
              <p className="text-gray-600">Real-time water quality analysis and management</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50"
                onClick={() => navigate("/water-quality/alerts")}
              >
                <ShieldAlert className="w-4 h-4" />
                View All Alerts
              </Button>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Activity className="w-4 h-4 animate-pulse text-teal-500" />
              {lastFetched ? `Updated ${timeAgo(lastFetched.toISOString())}` : "Loading…"}
              <button onClick={fetchReadings} className="ml-1 text-teal-600 hover:text-teal-800">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">

        {/* ── Active Alerts panel ── */}
        {activeAlerts.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-semibold">
              <AlertCircle className="w-5 h-5" />
              {activeAlerts.length} Active Water Quality Alert{activeAlerts.length !== 1 ? "s" : ""}
            </div>
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-red-100 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={`${severityBg(alert.severity)} border text-xs uppercase`}>
                      {alert.severity}
                    </Badge>
                    <span className="text-sm font-medium text-gray-800">{incidentLabel(alert.incident_type)}</span>
                    <span className="text-xs text-gray-500">Device: {alert.device_id}</span>
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(alert.last_seen_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No alerts banner — only when sensors actually have readings and all are clean */}
        {allClear && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">All water quality parameters within acceptable ranges</span>
          </div>
        )}

        {/* Waiting for first reading */}
        {sensors.length > 0 && sensorsWithReadings.length === 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 flex items-center gap-2 text-blue-700">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-medium">Devices registered — waiting for first telemetry. Start the simulator to begin streaming data.</span>
          </div>
        )}

        {/* ── Overview stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Sensors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{sensors.length || "—"}</div>
              <p className="text-xs text-gray-500 mt-1">pH + turbidity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Optimal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {sensorsWithReadings.length > 0 ? optimal : "—"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Within range</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {sensorsWithReadings.length > 0 ? warning : "—"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Needs attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {sensorsWithReadings.length > 0 ? critical : "—"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Immediate action</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Map ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-teal-600" />
              Sensor Map
            </CardTitle>
            <CardDescription>Live status of deployed water quality sensors</CardDescription>
          </CardHeader>
          <CardContent>
            {mapFocusPoints.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <MapContainer center={DUBAI_CENTER} zoom={12} style={{ height: "360px", width: "100%" }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                  <FitMapToPointsOnce points={mapFocusPoints} fallbackZoom={12} maxZoom={16} />
                  {layoutLatLng.length >= 3 && (
                    <Polygon positions={layoutLatLng} pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.2 }} />
                  )}
                  {mapSensors.map((device: any) => (
                    <CircleMarker
                      key={device.id}
                      center={[device.lat, device.lng]}
                      radius={8}
                      pathOptions={{ color: markerColor(device.liveStatus), fillOpacity: 0.85, weight: 2 }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1 min-w-[130px]">
                          <p className="font-semibold">{device.id}</p>
                          <p className="text-gray-500">{device.type?.replace(/_/g, " ")}</p>
                          {device.liveValue !== undefined && (
                            <p className="font-medium">
                              {device.liveMetric}: {Number(device.liveValue).toFixed(2)}
                            </p>
                          )}
                          <p className={`font-semibold ${device.liveStatus === "critical" ? "text-red-600" : device.liveStatus === "warning" ? "text-yellow-600" : "text-green-600"}`}>
                            {device.liveStatus?.toUpperCase()}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No layout polygon saved for this workspace yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Sensor Cards ── */}
        {loadingReadings && sensors.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Loading sensor data…</div>
        ) : sensors.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No sensor readings yet. Start the water quality simulator to begin streaming data.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sensors.map((sensor) => {
              const hasValue = sensor.value !== null && sensor.value !== undefined;
              const st = hasValue ? sensorStatus(sensor) : "unknown";
              const isPh = sensor.device_type === "ph_sensor";
              const isTurb = sensor.device_type === "turbidity_sensor";
              const val = hasValue ? Number(sensor.value).toFixed(2) : "—";

              // Human-readable label based on device ID
              const label = sensor.device_id;
              const typeLabel = isPh ? "pH Sensor" : isTurb ? "Turbidity Sensor" : sensor.device_type;

              return (
                <Card key={sensor.device_id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{label}</CardTitle>
                        <CardDescription className="mt-1">
                          {typeLabel} · MCU: {sensor.mcu_id}
                        </CardDescription>
                      </div>
                      <Badge className={`${statusBg(st)} border`}>
                        {st === "optimal" && <CheckCircle className="w-3 h-3 mr-1" />}
                        {(st === "warning" || st === "critical") && <AlertCircle className="w-3 h-3 mr-1" />}
                        {st.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    {/* Main reading */}
                    <div className="flex items-end gap-3">
                      {isPh && <Droplet className="w-8 h-8 text-blue-400 mb-1" />}
                      {isTurb && (
                        <div className="w-8 h-8 rounded-full bg-amber-200 border-2 border-amber-400 mb-1 flex items-center justify-center">
                          <span className="text-xs font-bold text-amber-700">T</span>
                        </div>
                      )}
                      <div>
                        <div className="text-4xl font-bold text-gray-900">{val}</div>
                        <div className="text-sm text-gray-500">{isPh ? "pH" : "NTU"}</div>
                      </div>
                    </div>

                    {/* Range indicator */}
                    {isPh && (
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Optimal range</span><span className="font-medium">6.5 – 7.5</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Warning range</span><span className="font-medium">6.0 – 8.0</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Outside</span><span className="font-medium text-red-600">Critical</span>
                        </div>
                      </div>
                    )}
                    {isTurb && (
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Optimal</span><span className="font-medium">0 – 3 NTU</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Warning</span><span className="font-medium">3 – 5 NTU</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Critical</span><span className="font-medium text-red-600">&gt; 5 NTU</span>
                        </div>
                      </div>
                    )}

                    {/* Active alerts for this device */}
                    {alerts
                      .filter((a) => a.device_id === sensor.device_id && (a.status === "ongoing" || a.status === "open"))
                      .map((a) => (
                        <div key={a.id} className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5">
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="text-xs font-medium text-red-700">{incidentLabel(a.incident_type)}</span>
                          <span className="ml-auto text-xs text-gray-400">{timeAgo(a.last_seen_at)}</span>
                        </div>
                      ))}

                    <div className="text-xs text-gray-400 pt-1">
                      Last reading: {timeAgo(sensor.ts)}
                      {sensor.lat != null && sensor.lng != null && (
                        <span className="ml-2">· {sensor.lat.toFixed(4)}, {sensor.lng.toFixed(4)}</span>
                      )}
                    </div>

                    <div className="pt-2 border-t">
                      <button
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                        onClick={() =>
                          navigate(`/water-quality/recommendation/${sensor.device_id}`, {
                            state: {
                              zone: {
                                id: sensor.device_id,
                                zone: label,
                                ph: isPh ? sensor.value : null,
                                turbidity: isTurb ? sensor.value : null,
                                tds: null,
                                chlorine: null,
                                status: st,
                                lastUpdated: timeAgo(sensor.ts),
                              },
                            },
                          })
                        }
                      >
                        View Recommendation
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Recent Alerts History ── */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    Recent Alerts
                  </CardTitle>
                  <CardDescription className="mt-1">Water quality incidents detected by threshold monitoring</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => navigate("/water-quality/alerts")}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 pr-4 font-medium">Device</th>
                      <th className="pb-2 pr-4 font-medium">Severity</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {alerts.slice(0, 10).map((alert) => (
                      <tr key={alert.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium">{incidentLabel(alert.incident_type)}</td>
                        <td className="py-2 pr-4 text-gray-600 font-mono text-xs">{alert.device_id}</td>
                        <td className="py-2 pr-4">
                          <Badge className={`${severityBg(alert.severity)} border text-xs uppercase`}>
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs font-medium ${alert.status === "resolved" ? "text-green-600" : "text-orange-600"}`}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400 text-xs">{timeAgo(alert.last_seen_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Parameter Reference Guide ── */}
        <Card>
          <CardHeader>
            <CardTitle>Parameter Reference Guide</CardTitle>
            <CardDescription>Threshold ranges used for anomaly detection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">pH Level</h4>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm text-gray-600">Optimal: 6.5 – 7.5</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm text-gray-600">Warning: 6.0 – 8.0</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm text-gray-600">Critical: outside 6.0 – 8.0</span>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Turbidity (NTU)</h4>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm text-gray-600">Optimal: 0 – 3 NTU (Clear)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm text-gray-600">Warning: 3 – 5 NTU (Cloudy)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm text-gray-600">Critical: &gt; 5 NTU (Very Cloudy)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default WaterQualityMonitoring;
