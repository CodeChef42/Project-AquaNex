import { useState } from "react";
import { AlertCircle, Clock, MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "@/components/Breadcrumbs";
import PipelineAlertCard from "@/components/PipelineAlertCard";

const alerts = [
  { id: "831", severity: "high", time: "3m ago", location: "Zone 3, Pipe 845-D", type: "Pressure Drop", pipeLength: "150m", pipeType: "PVC" },
  { id: "830", severity: "critical", time: "15m ago", location: "Zone 5, Pipe 902-A", type: "Flow Interruption", pipeLength: "200m", pipeType: "Steel" },
  { id: "829", severity: "medium", time: "22m ago", location: "Zone 2, Pipe 674-C", type: "Minor Leak", pipeLength: "100m", pipeType: "HDPE" },
  { id: "828", severity: "high", time: "35m ago", location: "Zone 4, Pipe 773-B", type: "Pressure Surge", pipeLength: "180m", pipeType: "PVC" },
  { id: "827", severity: "critical", time: "41m ago", location: "Zone 1, Pipe 556-E", type: "Pipe Break", pipeLength: "250m", pipeType: "Steel" },
  { id: "826", severity: "medium", time: "48m ago", location: "Zone 3, Pipe 821-D", type: "Sensor Anomaly", pipeLength: "120m", pipeType: "HDPE" },
];

const PipelinesManagementPage = () => {
  const navigate = useNavigate();
  const [alertQueue] = useState(14);

  const getSeverityPriority = (severity: string) => {
    switch (severity) {
      case "critical": return 3;
      case "high": return 2;
      case "medium": return 1;
      default: return 0;
    }
  };

  const sortedAlerts = alerts.sort((a, b) => getSeverityPriority(b.severity) - getSeverityPriority(a.severity));
  const topAlerts = sortedAlerts.slice(0, 5); // Top 3-5, but take 5 to be safe

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
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Pipelines Management" }]} />

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Pipelines Management</h1>
        <p className="text-muted-foreground">Monitor and manage pipeline alerts and resources</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Top Priority Alerts</h2>

          {topAlerts.map((alert) => (
            <PipelineAlertCard key={alert.id} alert={alert} />
          ))}
        </div>

        {/* Alert Queue Summary */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Alert Queue</h2>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{alertQueue}</p>
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