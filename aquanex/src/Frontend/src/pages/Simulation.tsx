import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSimulation } from "@/contexts/SimulationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SimPage = "pipeline" | "soil" | "demand" | "water";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const isPipelineDeviceType = (type = "") => {
  const t = String(type || "").toLowerCase();
  return t.includes("flowmeter") || t.includes("pressure_sensor");
};

const metricGroup = (metric: string, type = "", id = "") => {
  const metricKey = String(metric || "").toLowerCase();
  const typeKey = String(type || "").toLowerCase();
  const idKey = String(id || "").toLowerCase();

  if (typeKey.includes("salinity") || idKey.includes("ss-")) return "salinity";
  if (typeKey.includes("flowmeter") || typeKey.includes("pressure_sensor")) {
    if (["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metricKey)) return "flow";
    if (["pressure_bar", "pressure"].includes(metricKey)) return "pressure";
  }

  if (["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metricKey) || typeKey.includes("flow")) return "flow";
  if (["pressure_bar", "pressure"].includes(metricKey) || typeKey.includes("pressure")) return "pressure";
  if (["ec_ds_m", "ec_ms_cm"].includes(metricKey)) return "salinity";
  if (["soil_moisture_pct"].includes(metricKey) || typeKey.includes("soil")) return "soil";
  if (["ph", "tds", "turbidity", "chlorine", "orp", "conductivity"].includes(metricKey) || typeKey.includes("quality")) return "water";
  return "other";
};

const matchesPage = (metric: string, type = "", id = "", page: SimPage) => {
  if (page === "pipeline") return isPipelineDeviceType(type);
  const group = metricGroup(metric, type, id);
  if (page === "soil") return group === "salinity";
  if (page === "demand") return group === "soil";
  return group === "water";
};

const inferMetric = (device: any) => {
  const knownMetric = String(device.metric || "").trim();
  if (knownMetric) return knownMetric;
  const lowerType = String(device.type || "").toLowerCase();
  if (lowerType.includes("salinity")) return "ec_ds_m";
  if (lowerType.includes("pressure")) return "pressure_bar";
  if (lowerType.includes("flow")) return "q_m3h";
  if (lowerType.includes("ph")) return "ph";
  if (lowerType.includes("soil")) return "soil_moisture_pct";
  return "value";
};

const Simulation = () => {
  const navigate = useNavigate();
  const { workspace, fetchWorkspace } = useAuth();
  const { isRunning, phase, cycleTime, records, logs, startSimulation, stopSimulation, clearLogs, clearRecords } = useSimulation();

  const [activePage, setActivePage] = useState<SimPage>("pipeline");
  const [deviceEnabled, setDeviceEnabled] = useState<Record<string, boolean>>({});
  const [intervalSec, setIntervalSec] = useState(
    Number(localStorage.getItem("aquanex_sim_interval_sec") || 60)
  );

  const gatewayId = String(workspace?.gateway_id || "").trim();
  const devices = useMemo(
    () => (Array.isArray(workspace?.devices) ? (workspace?.devices as any[]) : []),
    [workspace?.devices]
  );

  const activeDevices = useMemo(
    () => devices.filter((d) => deviceEnabled[d.id] !== false),
    [deviceEnabled, devices]
  );

  const pageDevices = useMemo(
    () => devices.filter((d) => matchesPage(inferMetric(d), d.type, d.id, activePage)),
    [activePage, devices]
  );

  const filteredLogs = useMemo(
    () => logs.filter((l) => l.page === "system" || l.page === activePage),
    [activePage, logs]
  );

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    devices.forEach((d) => {
      next[d.id] = deviceEnabled[d.id] ?? true;
    });
    setDeviceEnabled(next);
  }, [devices.map((d) => d.id).join("|")]);

  const filteredRecords = useMemo(
    () => records.filter((r) => matchesPage(r.metric, r.device_type, r.device_id, activePage)),
    [activePage, records]
  );

  const subpages: Array<{ id: SimPage; label: string }> = [
    { id: "pipeline", label: "Pipeline Data" },
    { id: "soil", label: "Soil Salinity" },
    { id: "demand", label: "Demand Forecasting" },
    { id: "water", label: "Water Quality" },
  ];

  const getPhaseColor = () => {
    switch (phase) {
      case "Leak": return "warning";
      case "Breakage": return "destructive";
      default: return "secondary";
    }
  };

  const handleIntervalChange = (val: number) => {
      const safe = clamp(val, 1, 60); // Allow up to 60s
      setIntervalSec(safe);
      localStorage.setItem("aquanex_sim_interval_sec", String(safe));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Telemetry Simulation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-streams all gateway devices. Controlled via Global Simulation Context.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/home")}>
          Back to Home
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gateway Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">Gateway: {gatewayId || "Not configured"}</Badge>
            <Badge variant="secondary">Devices: {devices.length}</Badge>
            <Badge variant="secondary">Enabled: {activeDevices.length}</Badge>
            <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "Streaming" : "Stopped"}</Badge>
            {isRunning && (
                <Badge variant={getPhaseColor() as any}>Phase: {phase} ({(cycleTime/1000).toFixed(0)}s)</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium">Interval (seconds)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={intervalSec}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
            <Button onClick={startSimulation} disabled={isRunning || !gatewayId || activeDevices.length === 0}>
              Start Global Sim
            </Button>
            <Button variant="outline" onClick={stopSimulation} disabled={!isRunning}>
              Stop
            </Button>
            <Button variant="ghost" onClick={clearLogs} disabled={logs.length === 0}>
              Clear Console
            </Button>
            <Button variant="ghost" onClick={clearRecords} disabled={records.length === 0}>
              Clear Telemetry
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Subpages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {subpages.map((page) => (
              <Button
                key={page.id}
                variant={activePage === page.id ? "default" : "outline"}
                onClick={() => setActivePage(page.id)}
              >
                {page.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{subpages.find((p) => p.id === activePage)?.label} - Device List</CardTitle>
        </CardHeader>
        <CardContent>
          {pageDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching devices in this subpage category.</p>
          ) : (
            <div className="rounded-xl border border-border divide-y">
              {pageDevices.map((device) => (
                <div key={device.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold">{device.id}</p>
                    <p className="text-muted-foreground">
                      {device.type} • MCU: {device.microcontroller_id}
                    </p>
                    <p className="text-muted-foreground">
                      Metric: {inferMetric(device)}
                      {device.zone_id ? ` • Zone: ${device.zone_id}` : ""} • Coords:{" "}
                      {typeof device.lat === "number" && typeof device.lng === "number"
                        ? `${device.lat.toFixed(6)}, ${device.lng.toFixed(6)}`
                        : "N/A"}
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={deviceEnabled[device.id] !== false}
                      onChange={(e) =>
                        setDeviceEnabled((prev) => ({
                          ...prev,
                          [device.id]: e.target.checked,
                        }))
                      }
                    />
                    Enabled
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{subpages.find((p) => p.id === activePage)?.label} - Live Telemetry Records</CardTitle>
        </CardHeader>
        <CardContent>
          {activePage === "water" ? (
            // WQ data comes exclusively from the Python IoT simulator — show live workspace readings
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Water quality readings are provided by the standalone Python IoT simulator
                (<code>water_quality_simulator.py</code>). Values below reflect the latest
                readings received by the backend.
              </p>
              {pageDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No water quality devices found in this workspace.</p>
              ) : (
                <div className="rounded-xl border border-border divide-y">
                  {pageDevices.map((device) => {
                    const val = device.reading;
                    const metric = inferMetric(device);
                    const lastSeen = device.last_seen
                      ? new Date(device.last_seen).toLocaleTimeString()
                      : "—";
                    return (
                      <div key={device.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold font-mono">{device.id}</p>
                          <p className="text-muted-foreground">{device.type}</p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="font-mono text-sm font-bold">
                            {val != null ? Number(val).toFixed(2) : "—"}{" "}
                            <span className="text-muted-foreground font-normal">{metric}</span>
                          </p>
                          <p className="text-muted-foreground">Last seen: {lastSeen}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : filteredRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records yet for this subpage.</p>
          ) : (
            <div className="rounded-xl border border-border h-80 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Device Type</th>
                    <th className="text-left p-2">Device ID</th>
                    <th className="text-left p-2">Metric</th>
                    <th className="text-left p-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-2 font-mono">{new Date(row.ts).toLocaleTimeString()}</td>
                      <td className="p-2">{row.device_type}</td>
                      <td className="p-2 font-mono">{row.device_id}</td>
                      <td className="p-2">{row.metric}</td>
                      <td className="p-2">{row.reading.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{subpages.find((p) => p.id === activePage)?.label} - Console</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-black text-green-200 font-mono text-xs h-80 overflow-auto p-3 space-y-2">
            {filteredLogs.length === 0 ? (
              <p className="text-green-400/80">No events yet for this subpage.</p>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id}>
                  <span className="text-green-400">[{log.ts}]</span>{" "}
                  <span
                    className={
                      log.level === "error"
                        ? "text-red-300"
                        : log.level === "success"
                        ? "text-emerald-300"
                        : "text-sky-300"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Simulation;
