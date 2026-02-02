import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Wrench, Clock } from "lucide-react";
import PipelinesMapView from "./PipelinesMapView";
import ResourceAllocationModal from "./ResourceAllocationModal";

interface Alert {
  id: string;
  severity: string;
  time: string;
  location: string;
  type: string;
  pipeLength: string;
  pipeType: string;
}

interface PipelineAlertCardProps {
  alert: Alert;
}

const PipelineAlertCard = ({ alert }: PipelineAlertCardProps) => {
  const [showMap, setShowMap] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);

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

  // Extract pipe ID from location, e.g., "Zone 3, Pipe 845-D" -> "845-D"
  const pipeId = alert.location.split("Pipe ")[1] || alert.id;

  return (
    <>
      <Card className="hover:shadow-lg transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Alert #{alert.id}</CardTitle>
                <Badge variant={getSeverityColor(alert.severity) as any}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{alert.type}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Location</p>
                <p className="text-muted-foreground">{alert.location}</p>
              </div>
            </div>
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
                <p className="font-medium">Length</p>
                <p className="text-muted-foreground">{alert.pipeLength}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Type</p>
                <p className="text-muted-foreground">{alert.pipeType}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowMap(true)}
            >
              Map / Navigate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowAllocate(true)}
            >
              Allocate Resources
            </Button>
          </div>
        </CardContent>
      </Card>

      <PipelinesMapView
        open={showMap}
        onOpenChange={setShowMap}
        location={alert.location}
      />

      <ResourceAllocationModal
        open={showAllocate}
        onOpenChange={setShowAllocate}
        alertId={alert.id}
      />
    </>
  );
};

export default PipelineAlertCard;