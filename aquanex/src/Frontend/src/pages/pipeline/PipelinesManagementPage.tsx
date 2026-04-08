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

// Ray-Casting algorithm to check if a point is inside a polygon (Fixed for numerical accuracy)
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

const PipelinesManagementPage = () => {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  
  // State to hold officially registered pipelines from the Database
  const [registeredPipelines, setRegisteredPipelines] = useState<any[]>([]);

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const layoutPolygon = Array.isArray(workspace?.layout_polygon) ? workspace.layout_polygon : [];

  // Helper to check for at least 4 decimal places
  const hasValidPrecision = (val: string) => {
    if (!val) return false;
    const parts = String(val).split(".");
    return parts.length === 2 && parts[1].length >= 4;
  };

  // Real-time boundary & precision validation
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

  // FETCH PIPELINES FROM DB ON LOAD
  const fetchPipelines = async () => {
    try {
      // Adjust this endpoint string to match your Django URL router
      const res = await api.get("/pipelines/"); 
      const data = res.data?.results || res.data || [];
      setRegisteredPipelines(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch pipelines from database", err);
    }
  };

  // Async function to save to Database
  const handleSavePipeline = async () => {
    setIsSaving(true);
    setSaveError("");
    
    // Explicitly format the payload. We DO NOT send `pipe_id` anymore because Supabase generates it!
    const payloadToSave = { 
      start_lat: parseFloat(pipelineForm.start_lat),
      start_lng: parseFloat(pipelineForm.start_lng),
      end_lat: parseFloat(pipelineForm.end_lat),
      end_lng: parseFloat(pipelineForm.end_lng),
      pipeline_category: pipelineForm.pipeline_category,
      material: pipelineForm.material,
      pressure_class: pipelineForm.pressure_class,
      nominal_dia: parseFloat(pipelineForm.nominal_dia),
      depth: parseFloat(pipelineForm.depth),
      water_capacity: parseFloat(pipelineForm.water_capacity)
    };
    
    try {
      await api.post("/pipelines/", payloadToSave);

      // Force a fresh fetch from the DB to get the newly generated Postgres pipe_id
      await fetchPipelines(); 

      setPipelineState("success");
      setPipelineForm({ 
        pipeline_category: "mainline", material: "", pressure_class: "", nominal_dia: "", depth: "", water_capacity: "", start_lat: "", start_lng: "", end_lat: "", end_lng: "" 
      });
    } catch (err) {
      console.error("Database Save Error:", err);
      setSaveError("Failed to save pipeline to the database. Check console for details.");
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
    missingTypes,
    geolocatedModuleDevices,
    isConfigured,
  } = moduleSetup;
  
  const deviceTypeLabels: Record<string, string> = {
    flowmeter: "Flow Meter",
    pressure_sensor: "Pressure Sensor",
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
    fetchPipelines(); // Initialize pipelines on load!
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

  const isPressureDevice = (device: any) => String(device?.type || "").toLowerCase().includes("pressure");

  const buildDiamond = (lat: number, lng: number, size = 0.00008): [number, number][] => {
    const lngScale = Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
    const lngOffset = size / lngScale;
    return [[lat + size, lng], [lat, lng + lngOffset], [lat - size, lng], [lat, lng - lngOffset]];
  };

  // Ensure map bounds include Layout, Devices, AND Registered Pipelines
  const mapFocusPoints = useMemo<[number, number][]>(() => {
    const fromLayout = layoutPolygon
      .map((point: any) => [point?.[1], point?.[0]] as [number, number])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
      
    const fromDevices = geolocatedDevices.map((d: any) => [d.lat, d.lng] as [number, number]);
    
    const fromPipelines: [number, number][] = [];
    registeredPipelines.forEach(pipe => {
      if (!isNaN(parseFloat(pipe.start_lat))) {
        fromPipelines.push([parseFloat(pipe.start_lat), parseFloat(pipe.start_lng)]);
        fromPipelines.push([parseFloat(pipe.end_lat), parseFloat(pipe.end_lng)]);
      }
    });

    return [...fromLayout, ...fromDevices, ...fromPipelines];
  }, [geolocatedDevices, layoutPolygon, registeredPipelines]);

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
        if (rawTime) timeStr = new Date(rawTime).toLocaleTimeString("en-US", { timeZone: "Asia/Dubai", hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " GMT+4";
    } catch (e) {
        timeStr = "Invalid Time";
    }

    return {
        id: inc.id,
        severity: String(inc?.severity || "").toLowerCase() || "medium",
        time: timeStr,
        location: inc.location || `Gateway ${inc.gateway_id}`,
        type: inc.incident_type,
        pipeLength: "N/A",
        pipeType: "N/A",
        status: String(inc.status || "").trim().toLowerCase() || "open",
    };
  });

  const sortedAlerts = [...mappedAlerts].sort((a: any, b: any) => {
     if (a.status === 'recovering' && b.status !== 'recovering') return -1;
     if (b.status === 'recovering' && a.status !== 'recovering') return 1;
     return getSeverityPriority(b.severity) - getSeverityPriority(a.severity);
  });

  const topAlerts = useMemo(() => sortedAlerts.slice(0, 3), [sortedAlerts]);

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
            <CardTitle>Devices Not Configured</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Configure required pipeline devices to continue.</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Map</CardTitle>
        </CardHeader>
        <CardContent>
          {geolocatedDevices.length === 0 && layoutPolygon.length < 3 && registeredPipelines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pipeline devices or layout found.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden relative">
              <MapContainer center={DUBAI_CENTER} zoom={11} style={{ height: "560px", width: "100%" }}>
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                <FitMapToPoints points={mapFocusPoints} fallbackZoom={11} maxZoom={16} />
                
                {layoutPolygon.length > 2 && (
                  <Polygon positions={layoutPolygon.map((point: any) => [point[1], point[0]])} pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.15 }} />
                )}

                {/* Render DB Pipelines */}
                {registeredPipelines.map((pipe, index) => {
                  const positions: [number, number][] = [
                    [parseFloat(pipe.start_lat), parseFloat(pipe.start_lng)],
                    [parseFloat(pipe.end_lat), parseFloat(pipe.end_lng)]
                  ];

                  return (
                    <div key={`pipe-group-${pipe.pipe_id || index}`}>
                      <Polyline positions={positions} pathOptions={{ color: "#0284c7", weight: 12, opacity: 0.3, lineCap: "round" }} />
                      <Polyline positions={positions} pathOptions={{ color: "#38bdf8", weight: 4, dashArray: "10, 8", lineCap: "round" }}>
                        <Popup className="rounded-lg shadow-lg">
                          <div className="text-xs space-y-2 min-w-[200px] p-1">
                            <p className="font-bold text-sm text-primary uppercase border-b pb-1 mb-2">
                              System ID: {pipe.pipe_id || pipe.section_id || "Processing"}
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
                    </div>
                  );
                })}

                {/* Render Devices */}
                {geolocatedDevices.map((device: any) => (
                  <CircleMarker key={device.id} center={[device.lat, device.lng]} radius={7} pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}>
                    <Popup><p className="font-semibold">{device.id}</p><p>{device.type}</p></Popup>
                  </CircleMarker>
                ))}
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
            <div className="col-span-3 text-center py-8 text-muted-foreground bg-card rounded-xl border border-border">No active priority alerts</div>
          ) : (
            topAlerts.map((alert: any) => <PipelineAlertCard key={alert.id} alert={alert} onResolve={handleResolve} />)
          )}
        </div>
      </div>

      {/* Pipeline Registry Form */}
      {pipelineState === "form" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Pipeline Registry</h2>
          <Card>
            <CardContent className="pt-6 space-y-6">
              
              <div className="bg-muted/30 p-4 rounded-lg border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pipeline Specifications Descriptor</p>
                  <p className="text-lg font-mono font-medium text-primary">
                    {`${pipelineForm.pipeline_category || 'mainline'}-${pipelineForm.material || '[mat]'}-${pipelineForm.nominal_dia || '[dia]'}-${pipelineForm.pressure_class || '[press]'}-${pipelineForm.depth || '[depth]'}-${pipelineForm.water_capacity || '[cap]'}`}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Pipeline Category</label>
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
                    { label: "Material", placeholder: "e.g. uPVC", key: "material" },
                    { label: "Pressure Class", placeholder: "e.g. PN16", key: "pressure_class" },
                    { label: "Nominal Diameter (mm)", placeholder: "e.g. 110", key: "nominal_dia", type: "number" },
                    { label: "Depth (m)", placeholder: "e.g. 1.5", key: "depth", type: "number" },
                    { label: "Water Capacity (m³/h)", placeholder: "e.g. 45.0", key: "water_capacity", type: "number" },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                      <input
                        type={field.type || "text"} step="any" placeholder={field.placeholder}
                        value={pipelineForm[field.key as keyof typeof pipelineForm] || ""}
                        onChange={(e) => setPipelineForm((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-border" />

              <div>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Overall Coordinates</h3>
                  <p className="text-xs text-muted-foreground">For accurate boundary validation, please use precise coordinates (minimum 4 decimal places).</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Start Latitude", placeholder: "25.2048", key: "start_lat" },
                    { label: "Start Longitude", placeholder: "55.2708", key: "start_lng" },
                    { label: "End Latitude", placeholder: "25.1972", key: "end_lat" },
                    { label: "End Longitude", placeholder: "55.2744", key: "end_lng" },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                      <input
                        type="number" step="any" placeholder={field.placeholder}
                        value={pipelineForm[field.key as keyof typeof pipelineForm] || ""}
                        onChange={(e) => setPipelineForm((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      />
                    </div>
                  ))}
                </div>

                {/* Error Messages */}
                <div className="space-y-1 mt-3">
                  {validation.startOutOfBounds && <p className="text-red-500 text-xs font-medium">⚠️ Start coordinates are outside workspace boundaries.</p>}
                  {validation.endOutOfBounds && <p className="text-red-500 text-xs font-medium">⚠️ End coordinates are outside workspace boundaries.</p>}
                  {validation.startLacksPrecision && <p className="text-amber-500 text-xs font-medium">⚠️ Start coordinates require more precision (min 4 decimals).</p>}
                  {validation.endLacksPrecision && <p className="text-amber-500 text-xs font-medium">⚠️ End coordinates require more precision (min 4 decimals).</p>}
                  {saveError && <p className="text-red-500 text-xs font-medium mt-2">❌ {saveError}</p>}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button disabled={!validation.canSave || isSaving} onClick={handleSavePipeline}>
                  {isSaving ? "Saving..." : "Save Pipeline Data"}
                </Button>
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
              <p className="text-green-700 font-medium">Pipeline successfully registered and saved to database.</p>
            </div>
            <button
              onClick={() => setPipelineState("form")}
              className="text-green-600 hover:text-green-800 text-sm font-medium border border-green-300 px-3 py-1.5 rounded-lg"
            >
              Add Another Pipeline
            </button>
          </CardContent>
        </Card>
      )}
    </div> 
  );
};

export default PipelinesManagementPage;