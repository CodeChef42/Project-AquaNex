import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TrendingUp, Droplet, Send, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "@/lib/api";

type ChartView = "weekly" | "monthly" | "yearly";
type ChatMessage = { role: "user" | "assistant"; content: string };

const weeklyData = [
  { label: "07 Apr", ec: 5.8 },
  { label: "14 Apr", ec: 6.2 },
  { label: "21 Apr", ec: 6.8 },
  { label: "28 Apr", ec: 7.2 },
];

const monthlyData = [
  { label: "01 Apr", ec: 6.6 },
  { label: "05 Apr", ec: 6.8 },
  { label: "10 Apr", ec: 7.0 },
  { label: "15 Apr", ec: 7.1 },
  { label: "20 Apr", ec: 7.2 },
  { label: "25 Apr", ec: 7.1 },
  { label: "30 Apr", ec: 6.9 },
];

const yearlyData = [
  { label: "Jan", ec: 4.9 }, { label: "Feb", ec: 5.1 }, { label: "Mar", ec: 5.6 }, { label: "Apr", ec: 6.5 },
  { label: "May", ec: 6.9 }, { label: "Jun", ec: 7.1 }, { label: "Jul", ec: 7.0 }, { label: "Aug", ec: 6.8 },
  { label: "Sep", ec: 6.3 }, { label: "Oct", ec: 5.9 }, { label: "Nov", ec: 5.4 }, { label: "Dec", ec: 5.0 },
];

const ZoneDetail = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const currentEc = 7.2;
  const [waterQualityOpen, setWaterQualityOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [chartView, setChartView] = useState<ChartView>("weekly");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("Loading recommendations...");
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  const [mitigationActions, setMitigationActions] = useState<Array<{ title: string; detail: string }>>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything about salinity mitigation for this zone." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const chartData = useMemo(() => {
    if (chartView === "monthly") return monthlyData;
    if (chartView === "yearly") return yearlyData;
    return weeklyData;
  }, [chartView]);

  const chartTitle = useMemo(() => {
    if (chartView === "monthly") return "April 2026 - Monthly View";
    if (chartView === "yearly") return "Yearly View (Monthly Data)";
    return "April 2026 Weekly View";
  }, [chartView]);

  useEffect(() => {
    const fetchAiRecommendation = async () => {
      setAiLoading(true);
      try {
        const response = await api.post("/soil-salinity/assistant/", {
          mode: "recommendation",
          zone_id: zoneId,
          current_ec: currentEc,
          chart_view: chartView,
          chart_data: chartData,
        });
        const payload = response?.data || {};
        setAiSummary(String(payload.summary || "No summary returned."));
        setAiRecommendations(Array.isArray(payload.recommendations) ? payload.recommendations : []);
        setMitigationActions(Array.isArray(payload.mitigation_actions) ? payload.mitigation_actions : []);
      } catch {
        setAiSummary("Could not load AI recommendations. Please try again.");
        setAiRecommendations([]);
        setMitigationActions([]);
      } finally {
        setAiLoading(false);
      }
    };
    void fetchAiRecommendation();
  }, [chartData, chartView, zoneId]);

  const sendChat = async () => {
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await api.post("/soil-salinity/assistant/", {
        mode: "chat",
        zone_id: zoneId,
        current_ec: currentEc,
        question,
      });
      const reply = String(response?.data?.reply || "No response.");
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I could not reach AI service. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

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
          <p className="text-4xl font-bold text-destructive mt-2">{currentEc.toFixed(1)} dS/m</p>
        </div>
        <Button onClick={() => navigate("/soil-salinity")}>
          Back to Console
        </Button>
      </div>

      {/* Salinity Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Salinity Trend - {chartTitle}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant={chartView === "weekly" ? "default" : "outline"} size="sm" onClick={() => setChartView("weekly")}>
                Weekly
              </Button>
              <Button variant={chartView === "monthly" ? "default" : "outline"} size="sm" onClick={() => setChartView("monthly")}>
                Monthly
              </Button>
              <Button variant={chartView === "yearly" ? "default" : "outline"} size="sm" onClick={() => setChartView("yearly")}>
                Yearly
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)"
                }}
              />
              <Bar
                dataKey="ec" 
                stroke="hsl(var(--destructive))" 
                fill="hsl(var(--destructive))"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recommendation */}
        <Card className="border-primary/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="font-semibold text-primary mb-2">Summary</p>
              <p className="text-foreground">{aiLoading ? "Loading..." : aiSummary}</p>
            </div>
            <div className="space-y-2">
              {aiRecommendations.map((rec, idx) => (
                <div key={`${rec}-${idx}`} className="rounded-lg border p-3 text-sm">{rec}</div>
              ))}
            </div>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => setWaterQualityOpen(true)}
            >
              View Details
            </Button>
          </CardContent>
        </Card>

        {/* AI Chat */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Live AI Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-72 overflow-y-auto rounded-lg border p-3 space-y-2 bg-muted/20">
              {chatMessages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`rounded-lg p-2 text-sm ${msg.role === "user" ? "bg-primary/10 ml-4" : "bg-card mr-4"}`}
                >
                  <p className="font-medium mb-1">{msg.role === "user" ? "You" : "AI"}</p>
                  <p>{msg.content}</p>
                </div>
              ))}
              {chatLoading && <p className="text-xs text-muted-foreground">Thinking...</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about salinity mitigation..."
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mitigation Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Mitigation Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted p-3">
              <p className="font-semibold text-sm">AI Proposed Actions</p>
            </div>
            <div className="divide-y">
              {mitigationActions.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">No mitigation actions returned yet.</div>
              )}
              {mitigationActions.map((action, idx) => (
                <div key={`${action.title}-${idx}`} className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{action.title}</p>
                    <p className="text-sm text-muted-foreground">{action.detail}</p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              ))}
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
                <p className="text-lg font-semibold">{currentEc.toFixed(1)} dS/m</p>
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
            <Button 
              onClick={() => setWaterQualityOpen(false)}
            >
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
