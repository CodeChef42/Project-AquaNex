import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import api from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AlertList = () => {
  const navigate = useNavigate();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
      setIncidents(rows);
    } catch (err) {
      console.error("Failed to fetch incidents", err);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const timer = setInterval(fetchIncidents, 5000);
    return () => clearInterval(timer);
  }, []);

  const alerts = useMemo(() => {
    const toTime = (raw?: string) => {
      if (!raw) return "N/A";
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return "N/A";
      return date.toLocaleString("en-US", {
        timeZone: "Asia/Dubai",
        hour12: true,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };

    const severityWeight: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
    return incidents
      .map((inc: any) => ({
        id: String(inc.id),
        severity: deriveSeverity(inc),
        type: String(inc.incident_type || "anomaly"),
        location: String(inc.location || `Gateway ${inc.gateway_id || "unknown"}`),
        time: toTime(inc.last_seen_at || inc.created_at || inc.detected_at),
        status: String(inc.status || "open").trim().toLowerCase(),
        prediction: inc.details?.prediction || null,
      }))
      .sort((a: any, b: any) => {
        if (a.status === "recovering" && b.status !== "recovering") return -1;
        if (b.status === "recovering" && a.status !== "recovering") return 1;
        return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      });
  }, [incidents]);

  const handleResolve = async (id: string) => {
    try {
      await api.post(`/incidents/${id}/resolve/`);
      fetchIncidents();
    } catch (err) {
      console.error("Failed to resolve incident", err);
    }
  };

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
      <Breadcrumbs 
          items={[
            { label: "Home", path: "/home" },
            { label: "Pipeline Management", path: "/pipeline" },
            { label: "Alert List" }
          ]} 
        />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Alert Queue</h1>
          <p className="text-muted-foreground">All pending pipeline alerts</p>
        </div>
        <Button onClick={() => navigate("/pipeline")}>
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Alerts ({alerts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents available.</p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alert ID</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <Fragment key={alert.id}>
                  <TableRow 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedRow(expandedRow === alert.id ? null : alert.id)}
                  >
                    <TableCell className="font-medium">#{alert.id}</TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{alert.type}</TableCell>
                    <TableCell>{alert.location}</TableCell>
                    <TableCell className="text-muted-foreground">{alert.time}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/pipeline/incident/${alert.id}`);
                          }}
                        >
                          View Details
                        </Button>
                        {alert.status === "recovering" && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolve(alert.id);
                            }}
                          >
                            Confirm Fix
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedRow === alert.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="p-4 space-y-2">
                          <p className="font-semibold">Alert Details</p>
                          <p className="text-sm text-muted-foreground">
                            Full context: {alert.type} detected in {alert.location}.
                          </p>
                          {alert?.prediction?.deltas && (
                            <p className="text-sm text-muted-foreground">
                              Flow delta: {String(alert.prediction.deltas.flow_delta ?? "N/A")} | Pressure delta: {String(alert.prediction.deltas.pressure_delta ?? "N/A")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertList;
