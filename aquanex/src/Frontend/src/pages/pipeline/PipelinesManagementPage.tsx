import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "@/components/Breadcrumbs";
import PipelineAlertCard from "@/components/PipelineAlertCard";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Polygon, useMap, LayerGroup } from "react-leaflet";
import { useModuleDeviceSetup } from "@/hooks/useModuleDeviceSetup";
import "leaflet/dist/leaflet.css";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

/**
 * UTILS
 */

// Ray-Casting algorithm to check if a point is inside a polygon
const isPointInPolygon = (lat: number, lng: number, polygon: any[]) => {
  if (!polygon || polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pI = polygon[i];
    const pJ = polygon[j];
    const isLngFirst = Number(pI[0]) > 40;
    const xi = isLngFirst ? Number(pI[0]) : Number(pI[1]);
    const yi = isLngFirst ? Number(pI[1]) : Number(pI[0]);
    const xj = isLngFirst ? Number(pJ[0]) : Number(pJ[1]);
    const yj = isLngFirst ? Number(pJ[1]) : Number(pJ[0]);
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

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

const getSeverityPriority = (sev: string) => {
    const s = String(sev).toLowerCase();
    if (s === 'critical') return 4;
    if (s === 'high') return 3;
    if (s === 'medium') return 2;
    return 1;
};

const normalizeToken = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const toNum = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const midpointFromPipe = (pipe: any): { lat: number; lng: number } | null => {
  const sLat = toNum(pipe?.start_lat);
  const sLng = toNum(pipe?.start_lng);
  const eLat = toNum(pipe?.end_lat);
  const eLng = toNum(pipe?.end_lng);
  if ([sLat, sLng, eLat, eLng].every((v) => v !== null)) {
    return {
      lat: ((sLat as number) + (eLat as number)) / 2,
      lng: ((sLng as number) + (eLng as number)) / 2,
    };
  }
  return null;
};

const nearestPipeByPoint = (source: { lat: number; lng: number } | null, rows: any[]): any | null => {
  if (!source || !Array.isArray(rows) || rows.length === 0) return null;
  let best: any | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const pipe of rows) {
    const mid = midpointFromPipe(pipe);
    if (!mid) continue;
    const dist = (mid.lat - source.lat) ** 2 + (mid.lng - source.lng) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = pipe;
    }
  }
  return best;
};

const firstPipeWithCoordinates = (rows: any[]): any | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    rows.find((pipe) => midpointFromPipe(pipe) !== null) ||
    rows[0] ||
    null
  );
};

/**
 * MAIN COMPONENT
 */
const PipelinesManagementPage = () => {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [registeredPipelines, setRegisteredPipelines] = useState<any[]>([]);
  const [forceSetup, setForceSetup] = useState(false);
  const [wasScanning, setWasScanning] = useState(false);

  // Form State
  const [pipelineForm, setPipelineForm] = useState<any>({ 
    pipeline_category: "mainline", 
    material: "", 
    pressure_class: "", 
    nominal_dia: "", 
    depth: "",
    water_capacity: "",
    start_lat: "",
    start_lng: "",
    end_lat: "",
    end_lng: ""
  });
  
  const [pipelineState, setPipelineState] = useState<"form" | "success" | "done">("form");
  const [registryMode, setRegistryMode] = useState<"existing" | "new">("existing");
  const [selectedExistingPipeId, setSelectedExistingPipeId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const layoutPolygon = Array.isArray(workspace?.layout_polygon) ? workspace.layout_polygon : [];

  const hasValidPrecision = (val: string) => {
    if (!val) return false;
    const parts = String(val).split(".");
    return parts.length === 2 && parts[1].length >= 4;
  };

  const validation = useMemo(() => {
    const startLat = parseFloat(pipelineForm.start_lat);
    const startLng = parseFloat(pipelineForm.start_lng);
    const endLat = parseFloat(pipelineForm.end_lat);
    const endLng = parseFloat(pipelineForm.end_lng);

    const startOutOfBounds = !isNaN(startLat) && !isNaN(startLng) && !isPointInPolygon(startLat, startLng, layoutPolygon);
    const endOutOfBounds = !isNaN(endLat) && !isNaN(endLng) && !isPointInPolygon(endLat, endLng, layoutPolygon);
    const startLacksPrecision = pipelineForm.start_lat && pipelineForm.start_lng && (!hasValidPrecision(pipelineForm.start_lat) || !hasValidPrecision(pipelineForm.start_lng));
    const endLacksPrecision = pipelineForm.end_lat && pipelineForm.end_lng && (!hasValidPrecision(pipelineForm.end_lat) || !hasValidPrecision(pipelineForm.end_lng));
    const hasRequiredData = !!(pipelineForm.material && pipelineForm.start_lat && pipelineForm.end_lat);

    return {
      startOutOfBounds,
      endOutOfBounds,
      startLacksPrecision,
      endLacksPrecision,
      canSave: !startOutOfBounds && !endOutOfBounds && !startLacksPrecision && !endLacksPrecision && hasRequiredData
    };
  }, [pipelineForm, layoutPolygon]);

  // FETCH PIPELINES FROM DB
  const fetchPipelines = async () => {
    if (!workspace?.id) return;
    try {
      const res = await api.get("/pipelines/", {
          params: { workspace_id: workspace.id }
      }); 
      const data = res.data?.results || res.data || [];
      setRegisteredPipelines(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch pipelines", err);
    }
  };

  // SAVE PIPELINE TO DB
  const handleSavePipeline = async () => {
    if (!workspace?.id) return;
    setIsSaving(true);
    setSaveError("");
    
    // Construct the unique pipe_id based on specs
    const generatedPipeId = `${pipelineForm.pipeline_category || 'mainline'}-${pipelineForm.material || 'mat'}-${pipelineForm.nominal_dia || '0'}-${pipelineForm.pressure_class || 'press'}-${pipelineForm.depth || '0'}-${pipelineForm.water_capacity || '0'}`;

    const payloadToSave = { 
      pipe_id: generatedPipeId,
      workspace_id: workspace.id,
      start_lat: parseFloat(pipelineForm.start_lat),
      start_lng: parseFloat(pipelineForm.start_lng),
      end_lat: parseFloat(pipelineForm.end_lat),
      end_lng: parseFloat(pipelineForm.end_lng),
      pipeline_category: pipelineForm.pipeline_category,
      material: pipelineForm.material,
      pressure_class: pipelineForm.pressure_class,
      nominal_dia: parseFloat(pipelineForm.nominal_dia) || 0,
      depth: parseFloat(pipelineForm.depth) || 0,
      water_capacity: parseFloat(pipelineForm.water_capacity) || 0
    };

    try {
      await api.post("/pipelines/", payloadToSave);
      await fetchPipelines(); 

      setSelectedExistingPipeId(generatedPipeId);
      setPipelineState("success");
      setPipelineForm({ 
        pipeline_category: "mainline", material: "", pressure_class: "", nominal_dia: "", depth: "", water_capacity: "", start_lat: "", start_lng: "", end_lat: "", end_lng: "" 
      });
    } catch (err: any) {
      console.error("Database Save Error:", err.response?.data || err);
      setSaveError(err.response?.data?.error || "Failed to save pipeline to the database.");
    } finally {
      setIsSaving(false);
    }
  };

  const moduleSetup = useModuleDeviceSetup(["flowmeter", "pressure_sensor"]);
  const {
    gatewayIdInput,
    setGatewayIdInput,
    scanning,
    error,
    scanStatus,
    geolocatedModuleDevices,
    isConfigured,
    stripModuleDevices,
  } = moduleSetup;

  useEffect(() => {
    if (scanning) setWasScanning(true);
  }, [scanning]);
  useEffect(() => {
    if (wasScanning && !scanning && !error && forceSetup) {
      setWasScanning(false);
      setForceSetup(false);
    }
  }, [error, forceSetup, scanning, wasScanning]);

  const handleStartRescan = async () => {
    setForceSetup(true);
    setIncidents([]);
    await stripModuleDevices();
  };
  
  const fetchIncidents = async () => {
    try {
      const res = await api.get("/incidents/");
      const payload = res.data;
      let fetched = Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : []);
      setIncidents(fetched);
    } catch (err) {
      console.error("Failed to fetch incidents", err);
      setIncidents([]);
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchPipelines();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, [workspace?.id]);

  const handleResolve = async (id: string) => {
    try {
      await api.post(`/incidents/${id}/resolve/`);
      fetchIncidents();
    } catch (err) {
      console.error("Failed to resolve incident", err);
    }
  };

  // Map focus points calculation
  const mapFocusPoints = useMemo<[number, number][]>(() => {
    const fromLayout = layoutPolygon
      .map((point: any) => [point?.[1], point?.[0]] as [number, number])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
      
    const fromDevices = geolocatedModuleDevices.map((d: any) => [d.lat, d.lng] as [number, number]);
    
    const fromPipelines: [number, number][] = [];
    registeredPipelines.forEach(pipe => {
      const sl = parseFloat(pipe.start_lat);
      const el = parseFloat(pipe.end_lat);
      if (!isNaN(sl)) fromPipelines.push([sl, parseFloat(pipe.start_lng)]);
      if (!isNaN(el)) fromPipelines.push([el, parseFloat(pipe.end_lng)]);
    });
    return [...fromLayout, ...fromDevices, ...fromPipelines];
  }, [geolocatedModuleDevices, layoutPolygon, registeredPipelines]);

  const sortedAlerts = useMemo(() => {
    const findPipeForIncident = (inc: any, details: any) => {
      const candidates = [
        details?.pipe_id,
        details?.section_id,
        details?.comp_id,
        inc?.comp_id,
      ]
        .map(normalizeToken)
        .filter(Boolean);
      if (candidates.length === 0) return null;
      const exactMatch = (
        registeredPipelines.find((pipe: any) => {
          const pipeKey = normalizeToken(pipe?.pipe_id || pipe?.section_id);
          return pipeKey && candidates.includes(pipeKey);
        }) || null
      );
      if (exactMatch) return exactMatch;
      const incidentPoint =
        details?.section_midpoint && Number.isFinite(Number(details.section_midpoint.lat)) && Number.isFinite(Number(details.section_midpoint.lng))
          ? { lat: Number(details.section_midpoint.lat), lng: Number(details.section_midpoint.lng) }
          : details?.coordinates?.midpoint && Number.isFinite(Number(details.coordinates.midpoint.lat)) && Number.isFinite(Number(details.coordinates.midpoint.lng))
            ? { lat: Number(details.coordinates.midpoint.lat), lng: Number(details.coordinates.midpoint.lng) }
            : null;
      return nearestPipeByPoint(incidentPoint, registeredPipelines) || firstPipeWithCoordinates(registeredPipelines);
    };

    const mapped = incidents.map((inc: any) => {
      const rawTime = inc.created_at || inc.timestamp;
      let timeStr = "N/A";
      if (rawTime) timeStr = new Date(rawTime).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }) + " GST";
      const details = (inc && typeof inc.details === "object" && inc.details) || {};
      const matchedPipe = findPipeForIncident(inc, details);
      const midpoint = midpointFromPipe(matchedPipe) || details?.section_midpoint || details?.coordinates?.midpoint || null;
      const pipeId =
        matchedPipe?.pipe_id ||
        matchedPipe?.section_id ||
        details?.pipe_id ||
        details?.section_id ||
        details?.comp_id ||
        inc?.comp_id ||
        undefined;
      const alertId = details?.alert_id || `ALERT-${String(inc.id).slice(0, 8).toUpperCase()}`;
      const prediction = details?.prediction || {};
      const reason =
        String(prediction?.reason || "").trim() ||
        (prediction?.deltas
          ? `Flow delta ${prediction.deltas.flow_delta ?? "N/A"}, Pressure delta ${prediction.deltas.pressure_delta ?? "N/A"}`
          : `Model detected ${String(inc.incident_type || "anomaly").replace(/_/g, " ")}`);
      
      return {
          incidentId: String(inc.id),
          alertId: String(alertId),
          severity: String(inc?.severity || "").toLowerCase() || "medium",
          time: timeStr,
          reason,
          type: inc.incident_type,
          status: String(inc.status || "").trim().toLowerCase() || "open",
          pipeId,
          pipeType: matchedPipe?.pipeline_category || details?.pipe_specs?.pipe_category || "Unknown",
          coordinates:
            midpoint && Number.isFinite(Number(midpoint.lat)) && Number.isFinite(Number(midpoint.lng))
              ? { lat: Number(midpoint.lat), lng: Number(midpoint.lng) }
              : null,
          pipeSpecs: matchedPipe
            ? {
                section_id: matchedPipe.section_id || matchedPipe.pipe_id,
                flowmeter_id: matchedPipe.flowmeter_id ?? null,
                sensor_id: matchedPipe.sensor_id ?? null,
                material: matchedPipe.material ?? null,
                pressure_class: matchedPipe.pressure_class ?? null,
                depth: matchedPipe.depth ?? null,
                nominal_dia: matchedPipe.nominal_dia ?? null,
                pipe_category: matchedPipe.pipeline_category || matchedPipe.pipe_category || null,
                water_capacity: matchedPipe.water_capacity ?? null,
                pipe_id: matchedPipe.pipe_id || matchedPipe.section_id || null,
                start_lat: matchedPipe.start_lat ?? null,
                start_lng: matchedPipe.start_lng ?? null,
                end_lat: matchedPipe.end_lat ?? null,
                end_lng: matchedPipe.end_lng ?? null,
              }
            : details?.pipe_specs || null,
      };
    });

    return mapped.sort((a: any, b: any) => {
        if (a.status === 'recovering' && b.status !== 'recovering') return -1;
        if (b.status === 'recovering' && a.status !== 'recovering') return 1;
        return getSeverityPriority(b.severity) - getSeverityPriority(a.severity);
    });
  }, [incidents, registeredPipelines]);

  const topAlerts = sortedAlerts.slice(0, 3);

  if (!isConfigured || forceSetup) {
    return (
      <div className="p-8 space-y-6">
        <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Pipelines Management" }]} />
        <Card>
          <CardHeader><CardTitle>Pipeline Layout Map</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden relative">
              <MapContainer center={DUBAI_CENTER} zoom={11} style={{ height: "420px", width: "100%" }}>
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                <FitMapToPoints points={mapFocusPoints} fallbackZoom={11} maxZoom={16} />
                {layoutPolygon.length > 2 && (
                  <Polygon positions={layoutPolygon.map((point: any) => [point[1], point[0]])} pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.15 }} />
                )}
                {registeredPipelines.map((pipe, idx) => {
                  const sLat = parseFloat(pipe.start_lat);
                  const sLng = parseFloat(pipe.start_lng);
                  const eLat = parseFloat(pipe.end_lat);
                  const eLng = parseFloat(pipe.end_lng);
                  if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) return null;
                  return (
                    <Polyline
                      key={pipe.pipe_id || idx}
                      positions={[[sLat, sLng], [eLat, eLng]]}
                      pathOptions={{
                        color: "#2e8b57",
                        weight: 5,
                        dashArray: undefined,
                        lineCap: "round",
                      }}
                    />
                  );
                })}
                {geolocatedModuleDevices.map((device: any) => (
                  <CircleMarker key={device.id} center={[device.lat, device.lng]} radius={6} pathOptions={{ color: "#ef4444", fillOpacity: 0.9, weight: 1 }}>
                    <Popup><p className="font-semibold">{device.id}</p><p>{device.type}</p></Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{forceSetup ? "Rescan Devices" : "Devices Not Configured"}</CardTitle>
              {forceSetup && (
                <Button variant="outline" size="sm" onClick={() => setForceSetup(false)}>Cancel</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text" value={gatewayIdInput}
                onChange={(e) => setGatewayIdInput(e.target.value)}
                placeholder="Gateway ID"
                className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <Button onClick={() => moduleSetup.scanAndConfigure({ rescan: forceSetup })} disabled={scanning}>
                {scanning ? "Scanning..." : forceSetup ? "Rescan Devices" : "Configure Devices"}
              </Button>
            </div>
            {scanStatus && <p className="text-xs text-muted-foreground">{scanStatus}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Pipelines Management" }]} />
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleStartRescan}>Rescan Devices</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Pipeline Map</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border overflow-hidden relative">
            <MapContainer center={DUBAI_CENTER} zoom={11} style={{ height: "560px", width: "100%" }}>
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <FitMapToPoints points={mapFocusPoints} fallbackZoom={11} maxZoom={16} />
              
              {layoutPolygon.length > 2 && (
                <Polygon positions={layoutPolygon.map((point: any) => [point[1], point[0]])} pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.15 }} />
              )}

              {/* ✅ RENDER PIPELINES USING LAYERGROUP */}
              {registeredPipelines.map((pipe, idx) => {
                const sLat = parseFloat(pipe.start_lat);
                const sLng = parseFloat(pipe.start_lng);
                const eLat = parseFloat(pipe.end_lat);
                const eLng = parseFloat(pipe.end_lng);

                if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) return null;

                return (
                  <LayerGroup key={pipe.pipe_id || idx}>
                    {(() => {
                      return (
                        <>
                    <Polyline 
                      positions={[[sLat, sLng], [eLat, eLng]]} 
                      pathOptions={{ color: "#66cdaa", weight: 12, opacity: 0.35, lineCap: "round" }} 
                    />
                    <Polyline 
                      positions={[[sLat, sLng], [eLat, eLng]]} 
                      pathOptions={{ color: "#2e8b57", weight: 5, lineCap: "round" }}
                    >
                      <Popup>
                        <div className="text-xs space-y-2 min-w-[200px] p-1">
                          <p className="font-bold text-sm text-primary uppercase border-b pb-1 mb-2">
                            ID: {pipe.pipe_id}
                          </p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                            <span className="text-muted-foreground">Category:</span>
                            <span className="font-medium capitalize text-right">{pipe.pipeline_category || "N/A"}</span>
                            <span className="text-muted-foreground">Material:</span>
                            <span className="font-medium text-right">{pipe.material || "N/A"}</span>
                            <span className="text-muted-foreground">Diameter:</span>
                            <span className="font-medium text-right">{pipe.nominal_dia || "0"} mm</span>
                          </div>
                        </div>
                      </Popup>
                    </Polyline>
                        </>
                      );
                    })()}
                  </LayerGroup>
                );
              })}

              {/* Render Devices */}
              {geolocatedModuleDevices.map((device: any) => (
                <CircleMarker key={device.id} center={[device.lat, device.lng]} radius={7} pathOptions={{ color: "#ef4444", fillOpacity: 0.9, weight: 1 }}>
                  <Popup><p className="font-semibold">{device.id}</p><p>{device.type}</p></Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Priority Alerts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Priority Alerts</h2>
          <Button variant="ghost" className="text-primary hover:text-primary/80" onClick={() => navigate('/pipeline/alerts')}>
            View Full Alert List
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {topAlerts.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-muted-foreground bg-card rounded-xl border border-border">No active priority alerts</div>
          ) : (
            topAlerts.map((alert: any) => <PipelineAlertCard key={alert.incidentId} alert={alert} onResolve={handleResolve} />)
          )}
        </div>
      </div>

      {/* Registry Form */}
      {pipelineState === "form" && (
        <Card>
          <CardHeader><CardTitle>Pipeline Registry</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={registryMode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => setRegistryMode("existing")}
              >
                Select Existing
              </Button>
              <Button
                type="button"
                variant={registryMode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setRegistryMode("new")}
              >
                Register New
              </Button>
            </div>

            {registryMode === "existing" && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Select Existing Pipeline</p>
                <select
                  value={selectedExistingPipeId}
                  onChange={(e) => setSelectedExistingPipeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">Choose a pipeline...</option>
                  {registeredPipelines.map((pipe: any) => (
                    <option key={pipe.pipe_id} value={pipe.pipe_id}>
                      {pipe.pipe_id} ({pipe.pipeline_category || "pipeline"})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Selected pipeline is displayed on the map.
                </p>
              </div>
            )}

            {registryMode === "new" && (
              <>
            <div className="bg-muted/30 p-4 rounded-lg border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descriptor</p>
              <p className="text-lg font-mono font-medium text-primary">
                {`${pipelineForm.pipeline_category || 'mainline'}-${pipelineForm.material || '[mat]'}-${pipelineForm.nominal_dia || '[dia]'}-${pipelineForm.pressure_class || '[press]'}-${pipelineForm.depth || '[depth]'}-${pipelineForm.water_capacity || '[cap]'}`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={pipelineForm.pipeline_category}
                    onChange={(e) => setPipelineForm((prev: any) => ({ ...prev, pipeline_category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="mainline">Mainline</option>
                    <option value="subline">Subline</option>
                  </select>
                </div>
                {[
                  { label: "Material", key: "material" },
                  { label: "Pressure Class", key: "pressure_class" },
                  { label: "Diameter (mm)", key: "nominal_dia", type: "number" },
                  { label: "Depth (m)", key: "depth", type: "number" },
                  { label: "Capacity (m³/h)", key: "water_capacity", type: "number" },
                ].map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      value={pipelineForm[field.key] || ""}
                      onChange={(e) => setPipelineForm((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
              {[
                { label: "Start Lat", key: "start_lat" },
                { label: "Start Lng", key: "start_lng" },
                { label: "End Lat", key: "end_lat" },
                { label: "End Lng", key: "end_lng" },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                  <input
                    type="number" step="any"
                    value={pipelineForm[field.key] || ""}
                    onChange={(e) => setPipelineForm((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
                {validation.startOutOfBounds && <p className="text-red-500 text-xs">⚠️ Start coordinates are outside boundary.</p>}
                {validation.endOutOfBounds && <p className="text-red-500 text-xs">⚠️ End coordinates are outside boundary.</p>}
                {saveError && <p className="text-red-500 text-xs mt-2">❌ {saveError}</p>}
            </div>

            <div className="flex justify-end">
              <Button disabled={!validation.canSave || isSaving} onClick={handleSavePipeline}>
                {isSaving ? "Saving..." : "Save Pipeline"}
              </Button>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {pipelineState === "success" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 flex items-center justify-between">
            <p className="text-green-700 font-medium">✓ Pipeline saved successfully.</p>
            <Button variant="outline" onClick={() => setPipelineState("form")}>Add Another</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 

export default PipelinesManagementPage;
