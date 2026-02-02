import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const alerts = [
  { id: "831", severity: "high", time: "3m ago", location: "Zone 3, Pipe 845-D", type: "Pressure Drop" },
  { id: "830", severity: "critical", time: "15m ago", location: "Zone 5, Pipe 902-A", type: "Flow Interruption" },
  { id: "829", severity: "medium", time: "22m ago", location: "Zone 2, Pipe 674-C", type: "Minor Leak" },
  { id: "828", severity: "high", time: "35m ago", location: "Zone 4, Pipe 773-B", type: "Pressure Surge" },
  { id: "827", severity: "critical", time: "41m ago", location: "Zone 1, Pipe 556-E", type: "Pipe Break" },
  { id: "826", severity: "medium", time: "48m ago", location: "Zone 3, Pipe 821-D", type: "Sensor Anomaly" },
];

const AlertList = () => {
  const navigate = useNavigate();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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
          { label: "Dashboard", path: "/" },
          { label: "Pipeline Monitoring", path: "/pipeline" },
          { label: "Full Alert List" }
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
                <>
                  <TableRow 
                    key={alert.id}
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
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pipeline/incident/${alert.id}-incident`);
                        }}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRow === alert.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="p-4 space-y-2">
                          <p className="font-semibold">Alert Details</p>
                          <p className="text-sm text-muted-foreground">
                            Full context: {alert.type} detected in {alert.location}. 
                            Sensor patterns show abnormal readings. Immediate investigation recommended.
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Recommended Action: Dispatch maintenance crew and conduct visual inspection.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertList;
