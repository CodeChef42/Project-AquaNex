import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type AlertState = {
  incidentId?: string;
  alertId?: string;
  id?: string;
  type?: string;
  location?: string;
  pipeId?: string;
  coordinates?: { lat: number; lng: number } | null;
  pipeSpecs?: {
    section_id?: string;
    flowmeter_id?: number | null;
    sensor_id?: number | null;
    material?: string;
    pressure_class?: string | null;
    depth?: number | null;
    nominal_dia?: number | null;
    pipe_category?: string;
    water_capacity?: number | null;
    pipe_id?: string;
    start_lat?: number | string | null;
    start_lng?: number | string | null;
    end_lat?: number | string | null;
    end_lng?: number | string | null;
  } | null;
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

const nearestPipeByPoint = (
  source: { lat: number; lng: number } | null,
  rows: any[],
): any | null => {
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


const PipelineResources = () => {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const { incidentId } = useParams();
  const location = useLocation();
  const alert = (location.state as { alert?: AlertState } | null)?.alert;
  const [incidentDetails, setIncidentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pipes, setPipes] = useState<any[]>([]);
  const [resourcePlan, setResourcePlan] = useState<{ label: string; value: string }[]>([]);
  const [resourceSummary, setResourceSummary] = useState<string>("");
  const [resourceSource, setResourceSource] = useState<string>("");
  const [resourceLoading, setResourceLoading] = useState(false);

  useEffect(() => {
  let active = true;
  const fetchIncident = async () => {
    if (!incidentId) {
      if (active) setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/incidents/${incidentId}/`);
      if (active) setIncidentDetails(res.data);
      try {
        const workspaceId =
          res.data?.workspace_id ||
          res.data?.workspace ||
          res.data?.details?.workspace_id ||
          res.data?.details?.workspace ||
          workspace?.id ||
          localStorage.getItem("selected_workspace_id");
        if (!workspaceId) {
          if (active) setPipes([]);
          return;
        }
        const pipeRes = await api.get("/pipelines/", {
          params: { workspace_id: workspaceId },
        });
        const allPipes = pipeRes.data?.results || pipeRes.data || [];
        if (active && Array.isArray(allPipes)) setPipes(allPipes);
      } catch { /* no pipes */ }
    } catch {
      if (active) setIncidentDetails(null);
    } finally {
      if (active) setLoading(false);
    }
  };
  fetchIncident();
  return () => { active = false; };
}, [incidentId, workspace?.id]);

  const details = (incidentDetails && typeof incidentDetails.details === "object" && incidentDetails.details) || {};
  console.log("INCIDENT DETAILS:", JSON.stringify(incidentDetails?.details));
  console.log("PIPES:", JSON.stringify(pipes));

  
  const incidentType = String(alert?.type || incidentDetails?.incident_type || "Pipeline Leak");
  const incidentLocation = String(
    alert?.pipeId ||
      details?.pipe_id ||
      details?.section_id ||
      details?.comp_id ||
      "Unknown section",
  );

  const matchedPipe = useMemo(() => {
    const candidates = [
      alert?.pipeId,
      details?.pipe_id,
      details?.section_id,
      details?.comp_id,
      incidentDetails?.comp_id,
    ]
      .map(normalizeToken)
      .filter(Boolean);
    const exactMatch = pipes.find((pipe) => {
        const key = normalizeToken(pipe?.pipe_id || pipe?.section_id);
        return key && candidates.includes(key);
      }) || null;
    if (exactMatch) return exactMatch;

    const seedPoint =
      alert?.coordinates ||
      details?.section_midpoint ||
      details?.coordinates?.midpoint ||
      null;
    const nearest = nearestPipeByPoint(
      seedPoint &&
        Number.isFinite(Number(seedPoint.lat)) &&
        Number.isFinite(Number(seedPoint.lng))
        ? { lat: Number(seedPoint.lat), lng: Number(seedPoint.lng) }
        : null,
      pipes,
    );
    if (nearest) return nearest;
    return firstPipeWithCoordinates(pipes);
  }, [alert?.pipeId, alert?.coordinates, details?.pipe_id, details?.section_id, details?.comp_id, details?.section_midpoint, details?.coordinates?.midpoint, incidentDetails?.comp_id, pipes]);

  const mapCoordinates = useMemo(() => {
    const pipeMidpoint = midpointFromPipe(matchedPipe);
    if (pipeMidpoint) return pipeMidpoint;
    const fallbackPipeMidpoint = midpointFromPipe(firstPipeWithCoordinates(pipes));
    if (fallbackPipeMidpoint) return fallbackPipeMidpoint;
    return alert?.coordinates || details?.section_midpoint || details?.coordinates?.midpoint || null;
  }, [matchedPipe, pipes, alert?.coordinates, details?.section_midpoint, details?.coordinates?.midpoint]);

  const mapsUrl =
    mapCoordinates && Number.isFinite(mapCoordinates.lat) && Number.isFinite(mapCoordinates.lng)
      ? `https://www.google.com/maps?q=${mapCoordinates.lat},${mapCoordinates.lng}`
      : "";

  const pipeSpec = useMemo(() => {
  const source = matchedPipe || firstPipeWithCoordinates(pipes) || details?.pipe_specs || alert?.pipeSpecs;
  if (!source) return {
    section_id: "N/A", flowmeter_id: null, sensor_id: null,
    material: "N/A", pressure_class: "N/A", depth: null,
    nominal_dia: null, pipe_category: "N/A", water_capacity: null, pipe_id: "N/A",
  };
  return {
    section_id:     source.section_id     || "N/A",
 
    material:       source.material       || "N/A",
    pressure_class: source.pressure_class || "N/A",
    depth:          source.depth          ?? null,
    nominal_dia:    source.nominal_dia    ?? null,
    pipe_category:  source.pipeline_category || source.pipe_category || "N/A",
    water_capacity: source.water_capacity ?? null,
    pipe_id:        source.pipe_id        || source.section_id || "N/A",
  };
}, [matchedPipe, pipes, details, alert?.pipeSpecs]);

  useEffect(() => {
    let active = true;
    const fetchResourcePlan = async () => {
      const hasSpecs =
        pipeSpec.pipe_id !== "N/A" ||
        pipeSpec.section_id !== "N/A" ||
        pipeSpec.material !== "N/A";
      if (!hasSpecs) {
        if (active) {
          setResourcePlan([]);
          setResourceSummary("");
          setResourceSource("");
        }
        return;
      }
      setResourceLoading(true);
      try {
        const response = await api.post("/pipelines/resources-plan/", {
          pipe_specs: {
            section_id: pipeSpec.section_id,
            pipe_id: pipeSpec.pipe_id,
            flowmeter_id: pipeSpec.flowmeter_id,
            sensor_id: pipeSpec.sensor_id,
            material: pipeSpec.material,
            pressure_class: pipeSpec.pressure_class,
            depth: pipeSpec.depth,
            nominal_dia: pipeSpec.nominal_dia,
            pipe_category: pipeSpec.pipe_category,
            water_capacity: pipeSpec.water_capacity,
          },
          incident_context: {
            incident_id: incidentId,
            incident_type: incidentType,
            severity: incidentDetails?.severity || "medium",
          },
        });
        const rows = Array.isArray(response.data?.resources_needed)
          ? response.data.resources_needed
          : [];
        if (active) {
          setResourcePlan(
            rows
              .filter((item: any) => item && typeof item.label === "string" && typeof item.value === "string")
              .map((item: any) => ({ label: item.label, value: item.value })),
          );
          setResourceSummary(String(response.data?.summary || "").trim());
          setResourceSource(String(response.data?.source || "").trim());
        }
      } catch {
        if (active) {
          setResourcePlan([]);
          setResourceSummary("");
          setResourceSource("");
        }
      } finally {
        if (active) setResourceLoading(false);
      }
    };
    fetchResourcePlan();
    return () => {
      active = false;
    };
  }, [pipeSpec, incidentId, incidentType, incidentDetails?.severity]);

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Home", path: "/home" },
          { label: "Pipeline Management", path: "/pipeline" },
          { label: `Resources ${incidentId || ""}`.trim() },
        ]}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Pipeline Repair Resources</h1>
          <p className="text-muted-foreground">
            Alert #{alert?.alertId || details?.alert_id || incidentId || alert?.id || "N/A"} · {incidentType} · {incidentLocation}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/pipeline")}>
            Back to Alerts
          </Button>
          <Button
            variant="outline"
            disabled={!mapsUrl}
            onClick={() => { if (mapsUrl) window.open(mapsUrl, "_blank", "noopener,noreferrer"); }}
          >
            Open In Google Maps
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resources Needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading incident resources...</p>}
          {!loading && resourceLoading && (
            <p className="text-sm text-muted-foreground">Generating resources plan...</p>
          )}
          {!loading && !resourceLoading && resourceSummary && (
            <p className="text-sm text-muted-foreground">{resourceSummary}</p>
          )}
          {!loading && !resourceLoading && resourceSource && (
            <p className="text-xs text-muted-foreground">Source: {resourceSource}</p>
          )}
          {!loading && pipeSpec.section_id === "N/A" && pipes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No linked pipe specification found in database for this alert.
            </p>
          )}
          {!loading && !resourceLoading && resourcePlan.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No generated resources available yet for this incident.
            </p>
          )}
          {resourcePlan.map((item) => (
            <div key={item.label} className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipe Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell>section_id</TableCell><TableCell>varchar</TableCell><TableCell>NO</TableCell><TableCell>{pipeSpec.section_id}</TableCell></TableRow>
              <TableRow><TableCell>flowmeter_id</TableCell><TableCell>bigint</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.flowmeter_id}</TableCell></TableRow>
              <TableRow><TableCell>sensor_id</TableCell><TableCell>bigint</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.sensor_id}</TableCell></TableRow>
              <TableRow><TableCell>material</TableCell><TableCell>text</TableCell><TableCell>NO</TableCell><TableCell>{pipeSpec.material}</TableCell></TableRow>
              <TableRow><TableCell>pressure_class</TableCell><TableCell>text</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.pressure_class}</TableCell></TableRow>
              <TableRow><TableCell>depth</TableCell><TableCell>numeric(10,2)</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.depth ?? "N/A"}{pipeSpec.depth != null ? " m" : ""}</TableCell></TableRow>
              <TableRow><TableCell>nominal_dia</TableCell><TableCell>numeric(10,2)</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.nominal_dia ?? "N/A"}{pipeSpec.nominal_dia != null ? " mm" : ""}</TableCell></TableRow>
              <TableRow><TableCell>pipe_category</TableCell><TableCell>text</TableCell><TableCell>NO</TableCell><TableCell>{pipeSpec.pipe_category}</TableCell></TableRow>
              <TableRow><TableCell>water_capacity</TableCell><TableCell>numeric(12,3)</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.water_capacity ?? "N/A"}{pipeSpec.water_capacity != null ? " m³/h" : ""}</TableCell></TableRow>
              <TableRow><TableCell>pipe_id</TableCell><TableCell>varchar</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.pipe_id}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PipelineResources;
