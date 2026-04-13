import { Info, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const Information = () => {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 border-b border-cyan-100 pb-4">
        <div className="bg-cyan-100 p-2 rounded-lg">
          <Info className="w-6 h-6 text-cyan-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Information</h1>
          <p className="text-slate-500 text-sm">Overview of the AquaNex management platform and modules.</p>
        </div>
      </div>

      <Card className="border-cyan-100 bg-white/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-cyan-600" />
            User Documentation
          </CardTitle>
          <CardDescription>Complete end-user guide for the AquaNex platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>
            AquaNex is an integrated water infrastructure platform that helps teams monitor field devices,
            detect anomalies, and coordinate mitigation actions across pipelines, water quality, soil salinity,
            and demand forecasting modules.
          </p>
          <div>
            <p className="font-semibold text-slate-700">Core Workflow</p>
            <p>1. Sign in and select your workspace.</p>
            <p>2. Configure gateway devices through module setup pages.</p>
            <p>3. Review live telemetry and anomaly predictions in each feature console.</p>
            <p>4. Track incidents, acknowledge statuses, and review analytics trends.</p>
            <p>5. Use simulation for controlled testing and validation before field rollout.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Feature Overview</p>
            <p><span className="font-medium">Pipeline Management:</span> monitors flow and pressure, detects leak/breakage patterns, and maps affected assets.</p>
            <p><span className="font-medium">Water Quality:</span> tracks pH and turbidity readings, surfaces quality risks, and provides action guidance.</p>
            <p><span className="font-medium">Soil Salinity:</span> follows EC trends, highlights salinity risks by zone, and provides mitigation recommendations.</p>
            <p><span className="font-medium">Demand Forecasting:</span> combines usage behavior and weather context for short-term demand planning.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Best Practices</p>
            <p>- Keep gateway and sensor metadata (location, IDs, pipe links) current.</p>
            <p>- Use Rescan Devices after changing device coordinates or mappings.</p>
            <p>- Validate incident lifecycle transitions through analytics and detail views.</p>
            <p>- Use simulation to verify expected anomaly behavior before production changes.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Information;
