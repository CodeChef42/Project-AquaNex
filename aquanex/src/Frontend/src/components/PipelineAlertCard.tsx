import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, Navigation } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Alert {
  incidentId: string;
  alertId: string;
  severity: string;
  time: string;
  reason: string;
  type: string;
  pipeId?: string;
  pipeType?: string;
  coordinates?: { lat: number; lng: number } | null;
  pipeSpecs?: Record<string, any> | null;
  status?: string;
}

interface PipelineAlertCardProps {
  alert: Alert;
  onResolve?: (id: string) => void;
}

const PipelineAlertCard = ({ alert, onResolve }: PipelineAlertCardProps) => {
  const navigate = useNavigate();

  const getSeverityColor = (severity: string) => {
    if (alert.status === 'recovering') return "default";
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

  const pipeId = alert.pipeId || "Unknown";
  const hasCoordinates =
    Number.isFinite(alert.coordinates?.lat) && Number.isFinite(alert.coordinates?.lng);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${alert.coordinates!.lat},${alert.coordinates!.lng}`
    : "";

  return (
    <>
      <Card className="hover:shadow-lg transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Pipe {pipeId}</CardTitle>
                <Badge variant={getSeverityColor(alert.severity) as any}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Alert #{alert.alertId}</p>
              <p className="text-sm text-muted-foreground">{alert.type}</p>
              <p className="text-sm text-muted-foreground">{alert.reason}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Pipe ID</p>
                <p className="text-muted-foreground">{pipeId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Coordinates</p>
                <p className="text-muted-foreground">
                  {hasCoordinates
                    ? `${alert.coordinates!.lat.toFixed(6)}, ${alert.coordinates!.lng.toFixed(6)}`
                    : "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Type</p>
                <p className="text-muted-foreground">{alert.pipeType || "Unknown"}</p>
              </div>
            </div>
          </div>
          {alert.status === 'recovering' ? (
            <div className="flex flex-col gap-2">
              <div className="p-2 bg-green-50 border border-green-200 rounded-md text-xs text-green-700">
                Normal data flow detected. Is the issue resolved?
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/pipeline/resources/${alert.incidentId}`, { state: { alert } })}
                >
                  Resources
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!hasCoordinates}
                  onClick={() => { if (hasCoordinates) window.open(mapsUrl, "_blank", "noopener,noreferrer"); }}
                >
                  <Navigation className="w-4 h-4 mr-1" />
                  Navigate
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onResolve && onResolve(alert.incidentId)}
                >
                  Confirm Fix
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/pipeline/resources/${alert.incidentId}`, { state: { alert } })}
              >
                Resources
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={!hasCoordinates}
                onClick={() => { if (hasCoordinates) window.open(mapsUrl, "_blank", "noopener,noreferrer"); }}
              >
                <Navigation className="w-4 h-4 mr-1" />
                Navigate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default PipelineAlertCard;
