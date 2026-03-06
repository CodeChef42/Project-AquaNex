import { useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TrendingUp, Droplet, Loader2, AlertTriangle, CheckCircle2, History, Map as MapIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const SoilMap = lazy(() => import("@/components/soil/SoilMap"));

interface TrendPoint {
  date: string;
  ec_avg: number;
}

interface ZoneDetailData {
  id: string;
  name: string;
  boundary: any;
  area_ha: number;
  soil_texture: string;
  ec_threshold: number;
  latest_ec: number | null;
  sensor_count: number;
  trend_data: TrendPoint[];
}

interface MitigationAction {
  id: string;
  zone: string;
  action_type: string;
  status: string;
  parameters: any;
  ai_recommendation: any;
  triggered_ec: number;
  created_at: string;
}

const ZoneDetail = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [waterQualityOpen, setWaterQualityOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const { data: zone, isLoading: isZoneLoading } = useQuery<ZoneDetailData>({
    queryKey: ["soil-zone", zoneId],
    queryFn: async () => {
      const response = await api.get(`/soil/zones/${zoneId}/`);
      return response.data;
    },
  });

  const { data: mitigations, isLoading: isMitigationsLoading } = useQuery<MitigationAction[]>({
    queryKey: ["soil-mitigations", zoneId],
    queryFn: async () => {
      const response = await api.get("/soil/mitigations/");
      return response.data.filter((m: any) => m.zone === zoneId);
    },
  });

  const updateMitigation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await api.patch(`/soil/mitigations/${id}/`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soil-mitigations", zoneId] });
      toast.success("Action updated successfully");
    },
    onError: () => {
      toast.error("Failed to update action");
    }
  });

  const handleApproveAll = async () => {
    const pending = mitigations?.filter(m => m.status === 'pending') || [];
    for (const m of pending) {
      await updateMitigation.mutateAsync({ id: m.id, status: 'approved' });
    }
    setApprovalOpen(false);
  };

  if (isZoneLoading || isMitigationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!zone) return <div>Zone not found</div>;

  const isActionRequired = (zone.latest_ec || 0) >= zone.ec_threshold;

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs 
          items={[
            { label: "Home", path: "/home" },
            { label: "Soil Salinity", path: "/soil-salinity" },
            { label: zone.name }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{zone.name} - Salinity Detail</h1>
            {isActionRequired && <Badge variant="destructive">ACTION REQUIRED</Badge>}
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-4xl font-bold ${isActionRequired ? 'text-destructive' : 'text-success'}`}>
              {zone.latest_ec?.toFixed(2) || "---"}
            </p>
            <span className="text-muted-foreground font-medium">dS/m</span>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/soil-salinity")}>
          Back to Console
        </Button>
      </div>

      {/* Salinity Trend & Heatmap Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Salinity Trend - Last 90 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={zone.trend_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                    labelFormatter={(str) => new Date(str).toLocaleDateString()}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ec_avg" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-md flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-primary" />
              Spatial Distribution Heatmap
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">IDW Interpolation</Badge>
          </CardHeader>
          <CardContent className="h-[300px] p-0 relative">
            <Suspense fallback={<div className="w-full h-full bg-muted animate-pulse" />}>
              <SoilMap 
                zones={[zone]} 
                selectedZoneId={zone.id}
                heatmapData={mitigations?.find(m => m.ai_recommendation?.idw_map)?.ai_recommendation?.idw_map}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Recommendation Section */}
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              AI Prescription Layer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mitigations?.some(m => m.ai_recommendation) ? (
              <div className="space-y-4">
                {mitigations.filter(m => m.ai_recommendation).map(m => (
                  <div key={m.id} className="space-y-3">
                    <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                      <p className="font-bold text-primary mb-1 uppercase text-xs tracking-wider">
                        Recommendation: {m.ai_recommendation.recommendation?.type || 'Leaching Cycle'}
                      </p>
                      <p className="text-foreground text-sm">
                        {m.ai_recommendation.recommendation?.description || 'Implement water leaching to reduce root zone salinity.'}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-background/50 p-2 rounded">
                          <span className="text-muted-foreground block">Water Required</span>
                          <span className="font-bold text-primary">
                            {m.ai_recommendation.leaching?.water_volume_liters?.toLocaleString() || "120,000"} L
                          </span>
                        </div>
                        <div className="bg-background/50 p-2 rounded">
                          <span className="text-muted-foreground block">Duration</span>
                          <span className="font-bold text-primary">
                            {m.ai_recommendation.leaching?.duration_hours_estimate || "48"} Hours
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted p-8 rounded-lg text-center">
                <p className="text-muted-foreground italic text-sm">
                  No active AI recommendations. System is monitoring within bounds.
                </p>
              </div>
            )}
            <Button 
              variant="outline" 
              className="w-full text-xs h-8"
              onClick={() => setWaterQualityOpen(true)}
            >
              Cross-Analyze Water Quality
            </Button>
          </CardContent>
        </Card>

        {/* HITL Mitigation Control */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-md">Mitigation Registry</CardTitle>
            <History className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 flex justify-between items-center">
                <p className="font-bold text-xs uppercase tracking-tighter">Action Items</p>
                <p className="text-[10px] text-muted-foreground">Human-in-the-Loop Required</p>
              </div>
              <div className="divide-y max-h-[240px] overflow-y-auto">
                {mitigations?.map((m) => (
                  <div key={m.id} className="p-3 flex justify-between items-center hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm capitalize">{m.action_type.replace('_', ' ')}</p>
                        <Badge variant={m.status === 'approved' ? 'success' : m.status === 'pending' ? 'warning' : 'secondary'} className="text-[9px] h-4 px-1 capitalize">
                          {m.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Triggered @ {m.triggered_ec} dS/m | {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {m.status === 'pending' && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => updateMitigation.mutate({ id: m.id, status: 'approved' })}
                        disabled={updateMitigation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {(!mitigations || mitigations.length === 0) && (
                  <div className="p-6 text-center text-muted-foreground italic text-xs">
                    No mitigation history found for this zone.
                  </div>
                )}
              </div>
            </div>
            {mitigations?.some(m => m.status === 'pending') && (
              <Button 
                className="w-full shadow-lg"
                onClick={() => setApprovalOpen(true)}
              >
                Approve All Recommendations
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Water Quality Integration Modal (Static placeholder for Phase 4) */}
      <Dialog open={waterQualityOpen} onOpenChange={setWaterQualityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Environmental Synergy Analysis - {zone.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-warning/10 p-4 rounded-lg border border-warning/30 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <div>
                <p className="font-bold text-warning text-sm">Irrigation Risk Detected</p>
                <p className="text-xs text-foreground mt-1">
                  Water pH is currently 5.8 (Target: 6.5). Leaching with acidic water may exacerbate nutrient runoff. 
                  Recommended: Pre-treat water supply or delay leaching 24h.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaterQualityOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Confirmation */}
      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Mitigation Approval</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to approve all pending AI recommendations for {zone.name}? 
              This will trigger field device updates and log the actions as "Approved".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalOpen(false)}>Cancel</Button>
            <Button onClick={handleApproveAll} disabled={updateMitigation.isPending}>
              {updateMitigation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZoneDetail;
