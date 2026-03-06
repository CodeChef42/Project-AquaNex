import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type IncidentRow = {
  id: string;
  gateway_id?: string;
  incident_type?: string;
  severity?: string;
  status?: string;
  detected_at?: string;
  last_seen_at?: string;
  created_at?: string;
};

type RangeMode = "weekly" | "monthly" | "yearly";

const parseIncidentDate = (incident: IncidentRow): Date | null => {
  const raw = incident.last_seen_at || incident.detected_at || incident.created_at;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isOngoing = (status: string) => {
  const value = String(status || "").trim().toLowerCase();
  return value !== "resolved" && value !== "closed";
};

const IncidentAnalysis = () => {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>("weekly");
  const autoSeedRef = useRef(false);

  const fetchIncidents = async () => {
    try {
      const res = await api.get("/incidents/");
      const payload = res.data;
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
      setIncidents(rows);
    } catch (err) {
      console.error("Failed to fetch incidents", err);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  const seedIncidents = async (count = 300, silent = false) => {
    try {
      if (!silent) setSeeding(true);
      await api.post("/incidents/seed/", { count, months_back: 12 });
      await fetchIncidents();
    } catch (err) {
      console.error("Failed to seed incidents", err);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (autoSeedRef.current) return;
    if (incidents.length >= 120) return;
    autoSeedRef.current = true;
    seedIncidents(320, true);
  }, [loading, incidents.length]);

  const normalized = useMemo(() => {
    return incidents
      .map((row) => ({ row, date: parseIncidentDate(row) }))
      .filter((item) => item.date !== null) as Array<{ row: IncidentRow; date: Date }>;
  }, [incidents]);

  const reportedIssues = incidents.length;
  const ongoingAlerts = incidents.filter((i) => isOngoing(String(i.status || ""))).length;
  const criticalAlerts = incidents.filter((i) => ["critical", "high"].includes(String(i.severity || "").toLowerCase())).length;

  const chartData = useMemo(() => {
    const now = new Date();

    if (rangeMode === "weekly") {
      const weekLabels = ["W1", "W2", "W3", "W4", "W5"];
      const counts = [0, 0, 0, 0, 0];
      normalized.forEach(({ date }) => {
        if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return;
        const idx = Math.min(4, Math.floor((date.getDate() - 1) / 7));
        counts[idx] += 1;
      });
      return weekLabels.map((label, idx) => ({ label, issues: counts[idx] }));
    }

    if (rangeMode === "monthly") {
      const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const counts = new Array(12).fill(0);
      normalized.forEach(({ date }) => {
        if (date.getFullYear() !== now.getFullYear()) return;
        counts[date.getMonth()] += 1;
      });
      return labels.map((label, idx) => ({ label, issues: counts[idx] }));
    }

    const years = [now.getFullYear() - 4, now.getFullYear() - 3, now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];
    const byYear: Record<number, number> = Object.fromEntries(years.map((y) => [y, 0]));
    normalized.forEach(({ date }) => {
      const y = date.getFullYear();
      if (y in byYear) byYear[y] += 1;
    });
    return years.map((y) => ({ label: String(y), issues: byYear[y] || 0 }));
  }, [normalized, rangeMode]);

  const recentRows = useMemo(() => {
    return [...normalized]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 14)
      .map(({ row, date }) => ({
        id: row.id,
        timestamp: date.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        incidentType: String(row.incident_type || "anomaly").replace(/_/g, " "),
        severity: String(row.severity || "medium").toLowerCase(),
        status: isOngoing(String(row.status || "")) ? "ONGOING" : "RESOLVED",
        gateway: String(row.gateway_id || "N/A"),
      }));
  }, [normalized]);

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="INCIDENT ANALYTICS ENGINE"
        subtitle="Operational alerts and issue trends"
        breadcrumbs={[{ label: "Home", path: "/home" }, { label: "Incident Analytics" }]}
      />

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={fetchIncidents}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <Button onClick={() => seedIncidents(300)} disabled={seeding}>
          <AlertTriangle className="w-4 h-4 mr-2" />
          {seeding ? "Populating..." : "Populate Incidents"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Issues Reported</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{reportedIssues}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alerts (Ongoing)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{ongoingAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High/Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{criticalAlerts}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <CardTitle>Alerts Trend</CardTitle>
          </div>
          <Tabs value={rangeMode} onValueChange={(val) => setRangeMode(val as RangeMode)}>
            <TabsList>
              <TabsTrigger value="weekly">
                <CalendarDays className="w-4 h-4 mr-1" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar dataKey="issues" name="Issues" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading incidents...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.timestamp}</TableCell>
                    <TableCell className="capitalize">{row.incidentType}</TableCell>
                    <TableCell>{row.gateway}</TableCell>
                    <TableCell>
                      <Badge variant={row.severity === "critical" ? "destructive" : row.severity === "high" ? "alert" : "secondary"}>
                        {row.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === "ONGOING" ? "warning" : "success"}>{row.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default IncidentAnalysis;
