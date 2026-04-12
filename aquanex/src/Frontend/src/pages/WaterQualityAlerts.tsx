import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, Droplet, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import api from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface WqIncident {
  id: string;
  incident_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;           // ongoing | recovering | resolved
  gateway_id: string;       // scoped to device_id for WQ incidents
  device_id?: string;
  detected_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
  details: Record<string, any>;
}

type FilterTab = "all" | "active" | "resolved" | "ph" | "turbidity";

const WQ_INCIDENT_TYPES = [
  "ph_warning",
  "ph_anomaly",
  "ph_critical",
  "turbidity_warning",
  "turbidity_spike",
  "turbidity_critical",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function incidentLabel(type: string) {
  const labels: Record<string, string> = {
    ph_warning: "pH Warning",
    ph_anomaly: "pH Anomaly",
    ph_critical: "pH Critical",
    turbidity_warning: "Turbidity Warning",
    turbidity_spike: "Turbidity Spike",
    turbidity_critical: "Turbidity Critical",
  };
  return labels[type] || type.replace(/_/g, " ");
}

function severityBg(s: string) {
  if (s === "critical") return "bg-red-100 text-red-800 border-red-300";
  if (s === "high")     return "bg-orange-100 text-orange-800 border-orange-300";
  if (s === "medium")   return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-blue-100 text-blue-800 border-blue-300";
}

function statusColor(s: string) {
  if (s === "resolved")   return "text-green-600";
  if (s === "recovering") return "text-blue-600";
  return "text-orange-600";
}

function statusLabel(s: string) {
  if (s === "resolved")   return "Resolved";
  if (s === "recovering") return "Recovering";
  if (s === "ongoing")    return "Ongoing";
  return s;
}

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Dubai",
    hour12: true,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationStr(start: string | null, end: string | null): string {
  if (!start) return "—";
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffMs = endMs - new Date(start).getTime();
  if (diffMs < 0) return "—";
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

// ─── Natural-language insight generation ─────────────────────────────────────

/** Groups consecutive incidents of the same (device, type) that are within
 *  GAP_MS of each other into a single event window. */
interface IncidentGroup {
  device_id: string;
  incident_type: string;
  severity: string;
  start: Date;
  end: Date;       // last_seen_at of the last incident in the group
  isActive: boolean;
}

const GAP_MS = 30 * 60 * 1000; // 30-minute window

function groupIncidents(incidents: WqIncident[]): IncidentGroup[] {
  // Sort oldest-first so we can walk forward in time
  const sorted = [...incidents].sort(
    (a, b) =>
      new Date(a.detected_at ?? 0).getTime() -
      new Date(b.detected_at ?? 0).getTime()
  );

  const groups: IncidentGroup[] = [];

  for (const inc of sorted) {
    if (!inc.detected_at) continue;
    const start = new Date(inc.detected_at);
    const end   = new Date(inc.last_seen_at ?? inc.detected_at);
    const device = inc.device_id || inc.gateway_id || "unknown";
    const isActive = inc.status === "ongoing" || inc.status === "recovering";

    // Try to extend an existing group for the same device + type
    const existing = groups.find(
      (g) =>
        g.device_id === device &&
        g.incident_type === inc.incident_type &&
        start.getTime() - g.end.getTime() <= GAP_MS
    );

    if (existing) {
      if (end > existing.end) existing.end = end;
      if (isActive) existing.isActive = true;
      // escalate severity
      const severityRank: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      if ((severityRank[inc.severity] ?? 0) > (severityRank[existing.severity] ?? 0)) {
        existing.severity = inc.severity;
      }
    } else {
      groups.push({ device_id: device, incident_type: inc.incident_type, severity: inc.severity, start, end, isActive });
    }
  }

  // Return newest-first
  return groups.sort((a, b) => b.start.getTime() - a.start.getTime());
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Dubai",
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generateInsight(g: IncidentGroup): string {
  const paramLabel: Record<string, string> = {
    ph_warning:           "pH levels slightly outside the optimal range",
    ph_anomaly:           "pH levels reached abnormal values",
    ph_critical:          "pH levels reached critical values",
    turbidity_warning:    "water turbidity rose above the warning threshold",
    turbidity_spike:      "water turbidity spiked to elevated levels",
    turbidity_critical:   "water turbidity reached critically high levels",
  };
  const param = paramLabel[g.incident_type] ?? "an anomaly was detected";

  const sameDay = formatDate(g.start) === formatDate(g.end);
  const dateStr = formatDate(g.start);
  const startStr = formatTime(g.start);
  const endStr   = formatTime(g.end);

  if (g.isActive) {
    return `On ${g.device_id}, ${param} starting on ${dateStr} at ${startStr} — still ongoing.`;
  }

  if (sameDay) {
    return `On ${g.device_id}, ${param} on ${dateStr} between ${startStr} and ${endStr}.`;
  }
  return `On ${g.device_id}, ${param} from ${dateStr} ${startStr} to ${formatDate(g.end)} ${endStr}.`;
}

// ─── Main component ──────────────────────────────────────────────────────────

const WaterQualityAlerts = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<WqIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await api.get("/incidents/", {
        params: { incident_types: WQ_INCIDENT_TYPES.join(",") },
      });
      const payload = res.data;
      const rows: WqIncident[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
        ? payload.results
        : [];
      // Normalise device_id — WQ incidents store device_id in gateway_id field
      const normalised = rows.map((r) => ({
        ...r,
        device_id: r.device_id || r.gateway_id,
      }));
      setIncidents(normalised);
      setLastFetched(new Date());
    } catch (err) {
      console.error("[WQ Alerts] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const id = setInterval(fetchIncidents, 10_000);
    return () => clearInterval(id);
  }, [fetchIncidents]);

  const handleResolve = async (incidentId: string) => {
    setResolvingId(incidentId);
    try {
      await api.post(`/incidents/${incidentId}/resolve/`);
      await fetchIncidents();
    } catch (err) {
      console.error("[WQ Alerts] resolve failed:", err);
    } finally {
      setResolvingId(null);
    }
  };

  // ── Grouped insights ───────────────────────────────────────────────────────

  const insightGroups = useMemo(() => groupIncidents(incidents), [incidents]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active   = incidents.filter((i) => i.status === "ongoing" || i.status === "recovering");
    const resolved = incidents.filter((i) => i.status === "resolved");
    const critical = incidents.filter((i) => i.severity === "critical");

    // Most affected device (by count)
    const deviceCounts: Record<string, number> = {};
    incidents.forEach((i) => {
      const d = i.device_id || "—";
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
    });
    const mostAffected = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return { total: incidents.length, active: active.length, resolved: resolved.length, critical: critical.length, mostAffected };
  }, [incidents]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (activeTab === "active")    return i.status === "ongoing" || i.status === "recovering";
      if (activeTab === "resolved")  return i.status === "resolved";
      if (activeTab === "ph")        return i.incident_type.startsWith("ph_");
      if (activeTab === "turbidity") return i.incident_type.startsWith("turbidity_");
      return true;
    });
  }, [incidents, activeTab]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",       label: `All (${incidents.length})` },
    { key: "active",    label: `Active (${stats.active})` },
    { key: "resolved",  label: `Resolved (${stats.resolved})` },
    { key: "ph",        label: "pH" },
    { key: "turbidity", label: "Turbidity" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-8">
          <nav className="text-sm text-gray-500 mb-4 flex items-center gap-1">
            <button
              onClick={() => navigate("/water-quality")}
              className="hover:text-teal-600 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Water Quality
            </button>
            <span className="mx-1">›</span>
            <span className="text-gray-900">Alerts History</span>
          </nav>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <ShieldAlert className="w-7 h-7 text-orange-500" />
                Water Quality Alerts
              </h1>
              <p className="text-gray-600">All abnormal readings detected by threshold monitoring</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {lastFetched && <span>Updated {timeAgo(lastFetched.toISOString())}</span>}
              <button
                onClick={fetchIncidents}
                className="text-teal-600 hover:text-teal-800"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Now</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stats.active > 0 ? "text-orange-600" : "text-green-600"}`}>
                {stats.active}
              </div>
              <p className="text-xs text-gray-500 mt-1">Ongoing / recovering</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stats.critical > 0 ? "text-red-600" : "text-gray-400"}`}>
                {stats.critical}
              </div>
              <p className="text-xs text-gray-500 mt-1">Severity level</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Most Affected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900 truncate">{stats.mostAffected}</div>
              <p className="text-xs text-gray-500 mt-1">Device ID</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Active alerts banner ── */}
        {stats.active > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 flex items-center gap-3 text-orange-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              {stats.active} alert{stats.active !== 1 ? "s are" : " is"} currently active.
              Investigate and resolve once the issue is cleared.
            </span>
          </div>
        )}

        {stats.active === 0 && stats.total > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 flex items-center gap-3 text-green-700">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">All alerts resolved — water quality parameters are within acceptable ranges.</span>
          </div>
        )}

        {/* ── Natural-language alert summaries ── */}
        {insightGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-teal-500" />
                Alert Summaries
              </CardTitle>
              <CardDescription>Plain-language description of each detected event</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {insightGroups.map((g, i) => {
                  const isActive = g.isActive;
                  const isCritical = g.severity === "critical";
                  const borderColor = isCritical
                    ? "border-red-300 bg-red-50"
                    : isActive
                    ? "border-orange-200 bg-orange-50"
                    : "border-gray-200 bg-gray-50";
                  const dotColor = isCritical
                    ? "bg-red-500"
                    : isActive
                    ? "bg-orange-400"
                    : "bg-gray-400";
                  return (
                    <li
                      key={i}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${borderColor}`}
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                      <span className="text-gray-700">{generateInsight(g)}</span>
                      {isActive && (
                        <Badge className="ml-auto shrink-0 bg-orange-100 text-orange-700 border border-orange-300 text-xs">
                          Active
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ── Tabs + table ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Alert History
                </CardTitle>
                <CardDescription className="mt-1">
                  Abnormal readings captured over the monitoring period
                </CardDescription>
              </div>
              {/* Filter tabs */}
              <div className="flex gap-1 flex-wrap">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === t.key
                        ? "bg-teal-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading alerts…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No alerts found for this filter.</p>
                {incidents.length === 0 && (
                  <p className="text-xs mt-2 text-gray-400">
                    Alerts appear here once the simulator starts sending abnormal readings.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 pr-4 font-medium">Alert Type</th>
                      <th className="pb-3 pr-4 font-medium">Device</th>
                      <th className="pb-3 pr-4 font-medium">Severity</th>
                      <th className="pb-3 pr-4 font-medium">Started</th>
                      <th className="pb-3 pr-4 font-medium">Duration</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((alert) => {
                      const isActive = alert.status === "ongoing" || alert.status === "recovering";
                      const isPh = alert.incident_type.startsWith("ph_");
                      return (
                        <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {isPh ? (
                                <Droplet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-amber-300 border border-amber-500 shrink-0" />
                              )}
                              <span className="font-medium text-gray-900">{incidentLabel(alert.incident_type)}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-gray-600">{alert.device_id || "—"}</td>
                          <td className="py-3 pr-4">
                            <Badge className={`${severityBg(alert.severity)} border text-xs uppercase`}>
                              {alert.severity}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-xs text-gray-500 whitespace-nowrap">
                            {formatTs(alert.detected_at)}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {durationStr(alert.detected_at, alert.resolved_at)}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs font-semibold ${statusColor(alert.status)}`}>
                              {statusLabel(alert.status)}
                            </span>
                          </td>
                          <td className="py-3">
                            {isActive ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2 border-green-300 text-green-700 hover:bg-green-50"
                                disabled={resolvingId === alert.id}
                                onClick={() => handleResolve(alert.id)}
                              >
                                {resolvingId === alert.id ? "…" : "Resolve"}
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Alert type breakdown ── */}
        {incidents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alert Type Breakdown</CardTitle>
              <CardDescription>How many times each threshold was breached</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {WQ_INCIDENT_TYPES.map((type) => {
                  const count = incidents.filter((i) => i.incident_type === type).length;
                  const activeCount = incidents.filter(
                    (i) => i.incident_type === type && (i.status === "ongoing" || i.status === "recovering")
                  ).length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={type}
                      className="rounded-lg border bg-white px-4 py-3 space-y-1"
                    >
                      <p className="text-xs font-semibold text-gray-700">{incidentLabel(type)}</p>
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                      {activeCount > 0 && (
                        <p className="text-xs text-orange-600 font-medium">{activeCount} active</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Threshold reference ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Threshold Reference</CardTitle>
            <CardDescription>Thresholds that trigger each alert level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">pH Sensor</h4>
                <div className="space-y-1 text-gray-600">
                  <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> pH Warning</span><span>6.5–8.0 (outside optimal)</span></div>
                  <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> pH Anomaly</span><span>6.0–6.5 or 8.0–8.5</span></div>
                  <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> pH Critical</span><span>&lt; 5.5 or &gt; 9.5</span></div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Turbidity Sensor</h4>
                <div className="space-y-1 text-gray-600">
                  <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Turbidity Warning</span><span>&gt; 3 NTU</span></div>
                  <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Turbidity Spike</span><span>&gt; 5 NTU</span></div>
                  <div className="flex justify-between"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Turbidity Critical</span><span>&gt; 10 NTU</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default WaterQualityAlerts;
