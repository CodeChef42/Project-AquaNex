import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Activity, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const severityVariant = (s: string): any => {
  if (s === "critical" || s === "high") return "destructive";
  if (s === "medium") return "warning";
  return "secondary";
};

const statusColor = (s: string) => {
  if (s === "open")       return "text-destructive";
  if (s === "recovering") return "text-yellow-500";
  return "text-green-500";
};

const relativeTime = (iso: string) => {
  if (!iso) return "N/A";
  const ms  = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

const IncidentDetails = () => {
  const { incidentId } = useParams();
  const navigate       = useNavigate();
  const { workspace }  = useAuth();

  const [incident,      setIncident]      = useState<any>(null);
  const [pipe,          setPipe]          = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [resolving,     setResolving]     = useState(false);
  const [sensorOpen,    setSensorOpen]    = useState(true);
  const [pipeOpen,      setPipeOpen]      = useState(true);

  const fetchIncident = async () => {
    if (!incidentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/incidents/${incidentId}/`);
      setIncident(res.data);

      // Try to find matching pipe by gateway_id or from details
      const gw      = res.data?.gateway_id;
      const pipeId  = res.data?.details?.pipe_id || res.data?.pipe_id;
      if (pipeId || gw) {
          // Fetch all workspace pipes — no direct incident↔pipe link exists yet
        try {
          const pipeRes = await api.get("/pipelines/", {
            params: { workspace_id: workspace?.id },
          });
          const pipes = pipeRes.data?.results || pipeRes.data || [];
          if (Array.isArray(pipes) && pipes.length > 0) setPipe(pipes[0]);
        } catch { /* pipe not found — show N/A */ }
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load incident.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncident(); }, [incidentId]);

  const handleResolve = async () => {
    if (!incidentId) return;
    setResolving(true);
    try {
      await api.post(`/incidents/${incidentId}/resolve/`);
      await fetchIncident();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to resolve.");
    } finally {
      setResolving(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin"/>
        Loading incident...
      </div>
    </div>
  );

  if (error || !incident) return (
    <div className="p-8 space-y-4">
      <Breadcrumbs items={[{label:"Home",path:"/home"},{label:"Pipelines",path:"/pipeline"},{label:"Incident"}]}/>
      <p className="text-destructive">{error || "Incident not found."}</p>
      <Button variant="outline" onClick={() => navigate("/pipeline")}>Back</Button>
    </div>
  );

  const details   = incident.details  || {};
  const deltas    = details.deltas    || {};
  const rule      = details.rule      || {};
  const inputData = details.input     || {};
  const metrics   = rule.metrics      || {};

  // Sensor readings from ML input
  const flowUp       = inputData.flow_1     ?? null;
  const flowDown     = inputData.flow_2     ?? null;
  const pressureUp   = inputData.pressure_1 ?? null;
  const pressureDown = inputData.pressure_2 ?? null;
  const flowDelta    = deltas.flow_delta     ?? null;
  const pressureDelta= deltas.pressure_delta ?? null;

  // Map coords: try pipe start/end, then workspace layout centroid
  const mapLat = pipe?.start_lat
    ? parseFloat(pipe.start_lat)
    : workspace?.layout_polygon?.[0]?.[1] ?? DUBAI_CENTER[0];
  const mapLng = pipe?.start_lng
    ? parseFloat(pipe.start_lng)
    : workspace?.layout_polygon?.[0]?.[0] ?? DUBAI_CENTER[1];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <Breadcrumbs items={[
        {label:"Home",path:"/home"},
        {label:"Pipelines",path:"/pipeline"},
        {label:`Incident ${incidentId?.slice(0,8)}…`}
      ]}/>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">
              Alert #{details.alert_id || incidentId?.slice(0,8)}
            </h1>
            <Badge variant={severityVariant(incident.severity)}>
              {(incident.severity || "unknown").toUpperCase()}
            </Badge>
            <Badge variant="outline" className={statusColor(incident.status)}>
              {incident.status?.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {incident.incident_type?.replace(/_/g," ")} · detected {relativeTime(incident.detected_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchIncident}>
            <RefreshCw className="w-3.5 h-3.5"/>
          </Button>
          {incident.status === "open" && (
            <Button size="sm" variant="destructive" onClick={handleResolve} disabled={resolving}>
              {resolving ? "Resolving…" : "Resolve"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate("/pipeline")}>
            Back
          </Button>
        </div>
      </div>

      {/* Summary grid */}
      <Card>
        <CardHeader><CardTitle className="text-base">Incident Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Gateway",      value: incident.gateway_id || "N/A" },
              { label: "Type",         value: incident.incident_type?.replace(/_/g," ") || "N/A" },
              { label: "Detected",     value: relativeTime(incident.detected_at) },
              { label: "Last Seen",    value: relativeTime(incident.last_seen_at) },
              { label: "Flow Δ",       value: flowDelta    != null ? `${Number(flowDelta).toFixed(2)} m³/h`  : "N/A" },
              { label: "Pressure Δ",   value: pressureDelta!= null ? `${Number(pressureDelta).toFixed(2)} bar` : "N/A" },
              { label: "Confidence",   value: details.confidence != null ? `${(Number(details.confidence)*100).toFixed(0)}%` : "N/A" },
              { label: "ML Source",    value: details.source || "N/A" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-muted-foreground">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipe specs */}
      <Collapsible open={pipeOpen} onOpenChange={setPipeOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-base">Pipe Specifications</CardTitle>
              {pipeOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {pipe ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { label: "Pipe ID",         value: pipe.pipe_id },
                    { label: "Category",        value: pipe.pipeline_category },
                    { label: "Material",        value: pipe.material },
                    { label: "Pressure Class",  value: pipe.pressure_class },
                    { label: "Diameter",        value: pipe.nominal_dia ? `${pipe.nominal_dia} mm` : "N/A" },
                    { label: "Depth",           value: pipe.depth       ? `${pipe.depth} m`        : "N/A" },
                    { label: "Capacity",        value: pipe.water_capacity ? `${pipe.water_capacity} m³/h` : "N/A" },
                    { label: "Start",           value: pipe.start_lat   ? `${pipe.start_lat}, ${pipe.start_lng}` : "N/A" },
                    { label: "End",             value: pipe.end_lat     ? `${pipe.end_lat}, ${pipe.end_lng}`     : "N/A" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-muted-foreground">{label}</p>
                      <p className="font-semibold">{value || "N/A"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pipe record found for gateway <strong>{incident.gateway_id}</strong>.
                  Register the pipe in Pipeline Management to see specs here.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sensor diagnostics */}
      <Collapsible open={sensorOpen} onOpenChange={setSensorOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary"/>
                <CardTitle className="text-base">Sensor Diagnostics</CardTitle>
              </div>
              {sensorOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:"Flow Upstream",    value: flowUp,       unit:"m³/h" },
                  { label:"Flow Downstream",  value: flowDown,     unit:"m³/h" },
                  { label:"Pressure Up",      value: pressureUp,   unit:"bar"  },
                  { label:"Pressure Down",    value: pressureDown, unit:"bar"  },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-xl font-bold ${value != null ? "text-destructive" : "text-muted-foreground"}`}>
                      {value != null ? Number(value).toFixed(2) : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">{unit}</p>
                  </div>
                ))}
              </div>

              {rule.reasons?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Triggered Rules</p>
                  <div className="flex flex-wrap gap-2">
                    {rule.reasons.map((r: string) => (
                      <Badge key={r} variant="outline" className="text-xs">
                        {r.replace(/_/g," ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(metrics).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t text-sm">
                  {Object.entries(metrics).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-muted-foreground text-xs">{k.replace(/_/g," ")}</p>
                      <p className="font-semibold">{Number(v).toFixed(3)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Map */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary"/>
            <CardTitle className="text-base">Location</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="rounded-lg border border-border overflow-hidden" style={{height:320}}>
            <MapContainer center={[mapLat, mapLng]} zoom={15} style={{height:"100%",width:"100%"}}>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles © Esri"
              />
              <CircleMarker center={[mapLat, mapLng]} radius={10}
                pathOptions={{color:"#ef4444",fillColor:"#ef4444",fillOpacity:0.9}}>
                <Popup>
                  <p className="font-semibold text-xs">{incident.gateway_id}</p>
                  <p className="text-xs">{incident.incident_type?.replace(/_/g," ")}</p>
                </Popup>
              </CircleMarker>
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncidentDetails;