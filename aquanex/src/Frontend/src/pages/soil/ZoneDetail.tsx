import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TrendingUp, Droplet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const trendData = [
  { day: "Day 1", ec: 5.2 },
  { day: "Day 15", ec: 5.8 },
  { day: "Day 30", ec: 6.4 },
  { day: "Day 45", ec: 6.9 },
  { day: "Day 60", ec: 7.1 },
  { day: "Day 75", ec: 7.2 },
  { day: "Day 90", ec: 7.2 },
];

const ZoneDetail = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const [waterQualityOpen, setWaterQualityOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs 
          items={[
            { label: "Home", path: "/home" },
            { label: "Soil Salinity", path: "/soil-salinity" },
            { label: `Zone ${zoneId}` }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">Zone {zoneId} - Salinity Detail</h1>
            <Badge variant="destructive">ACTION REQUIRED</Badge>
          </div>
          <p className="text-4xl font-bold text-destructive mt-2">7.2 dS/m</p>
        </div>
        <Button onClick={() => navigate("/soil-salinity")}>
          Back to Console
        </Button>
      </div>

      {/* Salinity Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Salinity Trend - Last 90 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)"
                }}
              />
              <Line 
                type="monotone" 
                dataKey="ec" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--destructive))", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Recommendation */}
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              AI Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="font-semibold text-primary mb-2">Primary Action</p>
              <p className="text-foreground">Apply Gypsum - 50kg per hectare</p>
              <p className="text-sm text-muted-foreground mt-2">
                Expected EC reduction: 1.8-2.2 dS/m over 30 days
              </p>
            </div>
            <div className="bg-secondary/10 p-4 rounded-lg">
              <p className="font-semibold text-secondary mb-2">Secondary Action</p>
              <p className="text-foreground">Implement leach irrigation cycle</p>
              <p className="text-sm text-muted-foreground mt-2">
                Duration: 48 hours | Water volume: 120,000 L
              </p>
            </div>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => setWaterQualityOpen(true)}
            >
              View Water Quality Impact
            </Button>
          </CardContent>
        </Card>

        {/* Mitigation Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Mitigation Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted p-3">
                <p className="font-semibold text-sm">Proposed Actions</p>
              </div>
              <div className="divide-y">
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">Gypsum Application</p>
                    <p className="text-sm text-muted-foreground">50kg/ha</p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">Leach Irrigation</p>
                    <p className="text-sm text-muted-foreground">48h cycle</p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              </div>
            </div>
            <Button 
              className="w-full"
              onClick={() => setApprovalOpen(true)}
            >
              Approve Actions
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Water Quality Modal */}
      <Dialog open={waterQualityOpen} onOpenChange={setWaterQualityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Water Quality Impact - Zone {zoneId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-warning/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-warning text-lg">⚠️</span>
                  </div>
                  <div>
                    <p className="font-semibold text-warning mb-2">Adjusted Recommendation</p>
                    <p className="text-sm">
                      Water pH is low (5.8). Adjust pH to 6.5-7.0 before implementing leach irrigation.
                      Low pH may increase aluminum toxicity during leaching.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Soil EC</p>
                <p className="text-lg font-semibold">7.2 dS/m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Water pH</p>
                <p className="text-lg font-semibold text-warning">5.8</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">TDS</p>
                <p className="text-lg font-semibold">680 ppm</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Turbidity</p>
                <p className="text-lg font-semibold">12 NTU</p>
              </div>
            </div>

            <div className="bg-info/10 p-3 rounded-lg">
              <p className="text-sm text-info">
                Integration Note: Modified based on Feature 4 (Water Quality) data
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaterQualityOpen(false)}>
              Close
            </Button>
            <Button onClick={() => setWaterQualityOpen(false)}>
              Confirm & Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Modal */}
      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Mitigation Action</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground mb-4">
              Are you sure you want to execute <strong>Leach Irrigation Cycle</strong> for Zone {zoneId}?
            </p>
            <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
              <p><strong>Action:</strong> 48-hour leach irrigation cycle</p>
              <p><strong>Water Volume:</strong> 120,000 L</p>
              <p><strong>Estimated Duration:</strong> 48 hours</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setApprovalOpen(false);
              navigate("/soil-salinity");
            }}>
              Approve & Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZoneDetail;
