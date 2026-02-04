import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Package, Users, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const IncidentDetail = () => {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [materialOpen, setMaterialOpen] = useState(false);
  const [sensorOpen, setSensorOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs 
        items={[
          { label: "Home", path: "/home" },
          { label: "Pipeline Management", path: "/pipeline" },
          { label: `Incident ${incidentId}` }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">Incident #{incidentId}</h1>
            <Badge variant="destructive">CRITICAL</Badge>
          </div>
          <p className="text-muted-foreground">In Progress - Blocked</p>
        </div>
        <Button onClick={() => navigate("/pipeline")}>
          Back to Dashboard
        </Button>
      </div>

      {/* Incident Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Incident Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Severity</p>
              <p className="font-semibold text-destructive">Critical</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-semibold">In Progress - Material Shortage</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Time Since Start</p>
              <p className="font-semibold">4h 23m</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-semibold">Zone 3, Pipe Segment 749-B</p>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">High-Level Recommendation</p>
            <p className="font-medium">Emergency pipe replacement required. Estimated repair time: 6-8 hours. Priority material: 12m steel pipe segment (DN300).</p>
          </div>

          <Button onClick={() => setMapOpen(true)} variant="secondary" className="w-full">
            <MapPin className="w-4 h-4 mr-2" />
            View in Maps
          </Button>
        </CardContent>
      </Card>

      {/* Progressive Disclosure Sections */}
      <div className="space-y-4">
        {/* Material & Crew */}
        <Collapsible open={materialOpen} onOpenChange={setMaterialOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-primary" />
                  <CardTitle>Material & Crew Details</CardTitle>
                </div>
                {materialOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Required Materials</h4>
                  <ul className="space-y-2">
                    <li className="flex justify-between items-center">
                      <span>Steel Pipe DN300 (12m)</span>
                      <Badge variant="destructive">Shortage</Badge>
                    </li>
                    <li className="flex justify-between items-center">
                      <span>Welding Equipment</span>
                      <Badge variant="success">Available</Badge>
                    </li>
                    <li className="flex justify-between items-center">
                      <span>Sealing Compound</span>
                      <Badge variant="success">Available</Badge>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Crew Assignment
                  </h4>
                  <p className="text-sm text-muted-foreground">Team XYZ - 4 technicians (On Site)</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Sensor Diagnostics */}
        <Collapsible open={sensorOpen} onOpenChange={setSensorOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-primary" />
                  <CardTitle>Sensor Diagnostics</CardTitle>
                </div>
                {sensorOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pressure (PSI)</p>
                    <p className="text-2xl font-bold text-destructive">12.3</p>
                    <p className="text-xs text-muted-foreground">Normal: 45-50 PSI</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Flow Rate (L/min)</p>
                    <p className="text-2xl font-bold text-destructive">145</p>
                    <p className="text-xs text-muted-foreground">Normal: 800-900 L/min</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sensor ID: S-749-B-01 | Last Reading: 2 minutes ago
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Map Modal */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-4xl h-[600px]">
          <DialogHeader>
            <DialogTitle>Incident Location - Zone 3</DialogTitle>
          </DialogHeader>
          <div className="flex-1 relative bg-muted rounded-lg overflow-hidden">
            {/* Simplified map representation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-destructive rounded-full mx-auto animate-pulse flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-destructive-foreground" />
                </div>
                <div className="bg-card p-4 rounded-lg shadow-lg max-w-sm">
                  <p className="font-semibold">Pipe Segment 749-B</p>
                  <p className="text-sm text-muted-foreground">Sensor ID: S-749-B-01</p>
                  <Button variant="link" size="sm" className="mt-2">
                    More Details →
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentDetail;
