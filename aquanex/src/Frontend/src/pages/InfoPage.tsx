import { useNavigate } from "react-router-dom";
import { Info, FileText, Youtube, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Information = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-in fade-in-50 duration-500">
      <div className="flex items-center gap-3 border-b border-cyan-100 pb-4 animate-in slide-in-from-top-2 duration-500">
        <div className="bg-cyan-100 p-2 rounded-lg">
          <Info className="w-6 h-6 text-cyan-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Information</h1>
          <p className="text-slate-500 text-sm">Overview, user documentation, demo walkthrough, and smart navigation support.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => navigate("/info/assistant")} className="gap-2">
            <Bot className="w-4 h-4" />
            Open AI Help Page
          </Button>
        </div>
      </div>

      <Card className="border-cyan-100 bg-white/50 backdrop-blur-sm animate-in fade-in-50 slide-in-from-bottom-1 duration-500">
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
          <p>
            AquaNex is an intelligent irrigation system focused on optimizing agricultural water usage and
            monitoring infrastructure health with real-time anomaly ingestion and leakage detection.
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
            <p className="font-semibold text-slate-700">Recommended Navigation Shortcuts</p>
            <p>- `/home`: dashboard overview and active workspace snapshot.</p>
            <p>- `/workspaces`: switch workspaces and inspect mapped irrigation spaces.</p>
            <p>- `/settings`: update workspace, organization, modules, and layout.</p>
            <p>- `/info`: quick docs, video walkthrough, and AI navigation help.</p>
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

      <Card className="border-cyan-100 bg-white/50 backdrop-blur-sm animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Youtube className="w-5 h-5 text-red-600" />
            Video Documentation
          </CardTitle>
          <CardDescription>Watch the AquaNex walkthrough and feature demonstration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-cyan-100 overflow-hidden aspect-video">
            <iframe
              title="AquaNex - Team Technium"
              src="https://www.youtube.com/embed/lELn8OGBGAc"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <p className="text-xs text-slate-500">
            Direct link: https://youtu.be/lELn8OGBGAc
          </p>
        </CardContent>
      </Card>

      <Card className="border-cyan-100 bg-white/50 backdrop-blur-sm animate-in fade-in-50 slide-in-from-bottom-3 duration-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="w-5 h-5 text-violet-600" />
            AI Navigation Help
          </CardTitle>
          <CardDescription>Use the dedicated AI Help subpage for fast, full-screen navigation guidance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate("/info/assistant")} className="gap-2">
            <Bot className="w-4 h-4" />
            Go To AI Help Subpage
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Information;
