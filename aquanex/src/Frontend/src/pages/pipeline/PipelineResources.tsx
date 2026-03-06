import { useMemo } from "react";
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

type AlertState = {
  id?: string;
  type?: string;
  location?: string;
};

const PipelineResources = () => {
  const navigate = useNavigate();
  const { incidentId } = useParams();
  const location = useLocation();
  const alert = (location.state as { alert?: AlertState } | null)?.alert;

  const incidentType = String(alert?.type || "Pipeline Leak");
  const incidentLocation = String(alert?.location || "Main irrigation trunk");

  const pipeSpec = useMemo(() => {
    const seed = Number(String(incidentId || "0").replace(/\D/g, "")) || 901;
    return {
      section_id: seed,
      flowmeter_id: seed + 10,
      sensor_id: seed + 20,
      material: seed % 2 === 0 ? "Ductile Iron" : "HDPE",
      pressure_class: seed % 2 === 0 ? "PN16" : "PN10",
      depth: Number((1.2 + (seed % 3) * 0.2).toFixed(2)),
      nominal_dia: seed % 2 === 0 ? 300 : 250,
      pipe_category: seed % 2 === 0 ? "Transmission Main" : "Distribution Main",
      water_capacity: Number((130 + (seed % 5) * 18.5).toFixed(1)),
      pipe_id: seed + 5000,
    };
  }, [incidentId]);

  const resourcePlan = useMemo(
    () => [
      { label: "Crew Type", value: "Pipeline maintenance team (4 technicians + 1 supervisor)" },
      { label: "Estimated Repair Window", value: incidentType.toLowerCase().includes("break") ? "6-10 hours" : "2-5 hours" },
      { label: "Isolation Requirement", value: "Upstream and downstream valve lockout with bypass check" },
      { label: "Safety Kit", value: "Confined-space PPE, gas detector, trench shoring set" },
      { label: "Materials", value: "Repair clamp, gasket set, couplings, anti-corrosion wrap" },
      { label: "Post-Repair Validation", value: "Pressure hold test + flow balance verification + sensor recalibration" },
    ],
    [incidentType]
  );

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
            Incident #{incidentId || alert?.id || "N/A"} · {incidentType} · {incidentLocation}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/pipeline")}>
          Back to Alerts
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resources Needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              <TableRow><TableCell>section_id</TableCell><TableCell>bigint</TableCell><TableCell>NO</TableCell><TableCell>{pipeSpec.section_id}</TableCell></TableRow>
              <TableRow><TableCell>flowmeter_id</TableCell><TableCell>bigint</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.flowmeter_id}</TableCell></TableRow>
              <TableRow><TableCell>sensor_id</TableCell><TableCell>bigint</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.sensor_id}</TableCell></TableRow>
              <TableRow><TableCell>material</TableCell><TableCell>text</TableCell><TableCell>NO</TableCell><TableCell>{pipeSpec.material}</TableCell></TableRow>
              <TableRow><TableCell>pressure_class</TableCell><TableCell>text</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.pressure_class}</TableCell></TableRow>
              <TableRow><TableCell>depth</TableCell><TableCell>numeric</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.depth} m</TableCell></TableRow>
              <TableRow><TableCell>nominal_dia</TableCell><TableCell>numeric</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.nominal_dia} mm</TableCell></TableRow>
              <TableRow><TableCell>pipe_category</TableCell><TableCell>text</TableCell><TableCell>NO</TableCell><TableCell>{pipeSpec.pipe_category}</TableCell></TableRow>
              <TableRow><TableCell>water_capacity</TableCell><TableCell>numeric</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.water_capacity} m³/h</TableCell></TableRow>
              <TableRow><TableCell>pipe_id</TableCell><TableCell>bigint</TableCell><TableCell>YES</TableCell><TableCell>{pipeSpec.pipe_id}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PipelineResources;
