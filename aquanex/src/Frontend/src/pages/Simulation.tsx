import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type WorkspaceDevice = {
  id: string;
  microcontroller_id: string;
  type: string;
  zone_id?: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  metric: string;
  reading: number | string;
  last_seen: string;
};

type SimPage = "pipeline" | "soil" | "demand" | "water";

type LogRow = {
  id: string;
  ts: string;
  level: "info" | "success" | "error";
  message: string;
  page: SimPage | "system";
};

type TelemetryRecord = {
  id: string;
  ts: string;
  device_id: string;
  device_type: string;
  metric: string;
  reading: number;
  values: Record<string, number>;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const randomAround = (base: number, span: number) => Number((base + (Math.random() * 2 - 1) * span).toFixed(3));

const metricGroup = (metric: string, type = "", id = "") => {
  const metricKey = String(metric || "").toLowerCase();
  const typeKey = String(type || "").toLowerCase();
  const idKey = String(id || "").toLowerCase();

  if (["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metricKey) || typeKey.includes("flow")) return "flow";
  if (["pressure_bar", "pressure"].includes(metricKey) || typeKey.includes("pressure")) return "pressure";
  if (["ec_ds_m", "ec_ms_cm"].includes(metricKey) || typeKey.includes("salinity") || idKey.includes("ss-")) return "salinity";
  if (["soil_moisture_pct"].includes(metricKey) || typeKey.includes("soil")) return "soil";
  if (["ph", "tds", "turbidity", "chlorine", "orp", "conductivity"].includes(metricKey) || typeKey.includes("quality")) return "water";
  return "other";
};

const matchesPage = (metric: string, type = "", id = "", page: SimPage) => {
  const group = metricGroup(metric, type, id);
  if (page === "pipeline") return group === "flow" || group === "pressure";
  if (page === "soil") return group === "salinity";
  if (page === "demand") return group === "soil";
  return group === "water";
};

const inferMetric = (device: WorkspaceDevice) => {
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

const inferSensorIndex = (device: WorkspaceDevice) => {
  const descriptor = `${device.id} ${device.type} ${device.metric}`.toLowerCase();
  if (/(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(descriptor)) return 1;
  if (/(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(descriptor)) return 2;
  return null;
};

const valueForMetric = (metric: string, previous?: number) => {
  if (["q_m3h", "flow_lpm", "flow"].includes(metric)) return randomAround(previous ?? 18, 3);
  if (["pressure_bar", "pressure"].includes(metric)) return randomAround(previous ?? 3.2, 0.4);
  if (metric === "ph") return randomAround(previous ?? 7.2, 0.2);
  if (metric === "soil_moisture_pct") return randomAround(previous ?? 42, 4);
  if (["ec_ds_m", "ec_ms_cm"].includes(metric)) return randomAround(previous ?? 1.8, 0.35);
  return randomAround(previous ?? 50, 5);
};

const Simulation = () => {
  const navigate = useNavigate();
  const { workspace, fetchWorkspace } = useAuth();

  const [activePage, setActivePage] = useState<SimPage>("pipeline");
  const [deviceEnabled, setDeviceEnabled] = useState<Record<string, boolean>>({});
  const [intervalSec, setIntervalSec] = useState(8);
  const [isRunning, setIsRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [records, setRecords] = useState<TelemetryRecord[]>([]);

  const latestValuesRef = useRef<Record<string, number>>({});
  const timerRef = useRef<number | null>(null);
  const simulationStartMsRef = useRef<number | null>(null);
  const autoStartArmedRef = useRef(false);

  const gatewayId = String(workspace?.gateway_id || "").trim();
  const devices = useMemo<WorkspaceDevice[]>(
    () => (Array.isArray(workspace?.devices) ? (workspace?.devices as WorkspaceDevice[]) : []),
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

  const filteredRecords = useMemo(
    () => records.filter((r) => matchesPage(r.metric, r.device_type, r.device_id, activePage)),
    [activePage, records]
  );

  const filteredLogs = useMemo(
    () => logs.filter((l) => l.page === "system" || l.page === activePage),
    [activePage, logs]
  );

  const addLog = (level: LogRow["level"], message: string, page: SimPage | "system" = "system") => {
    const entry: LogRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toLocaleTimeString(),
      level,
      message,
      page,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 300));
  };

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    devices.forEach((d) => {
      next[d.id] = deviceEnabled[d.id] ?? true;
    });
    setDeviceEnabled(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices.map((d) => d.id).join("|")]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const buildTelemetryBatch = () => {
    const ts = new Date().toISOString();
    if (simulationStartMsRef.current === null) {
      simulationStartMsRef.current = Date.now();
    }

    const elapsedMs = Date.now() - simulationStartMsRef.current;
    const highDeltaMode = elapsedMs >= 20000;

    return activeDevices.map((device) => {
      const metric = inferMetric(device);
      const prev = latestValuesRef.current[device.id];
      const group = metricGroup(metric, device.type, device.id);
      const sensorIndex = inferSensorIndex(device);

      let reading = valueForMetric(metric, prev);
      if (highDeltaMode && (group === "flow" || group === "pressure") && sensorIndex) {
        if (group === "flow") {
          reading = sensorIndex === 1 ? randomAround(85, 0.6) : randomAround(35, 0.6);
        } else {
          reading = sensorIndex === 1 ? randomAround(16, 0.2) : randomAround(6, 0.2);
        }
      }

      latestValuesRef.current[device.id] = reading;
      return {
        device_id: device.id,
        mcu_id: device.microcontroller_id,
        lat: device.lat,
        lng: device.lng,
        metric,
        reading,
        values: { [metric]: reading },
        ts,
      };
    });
  };

  const pushOnce = async () => {
    if (!gatewayId) {
      addLog("error", "No gateway is saved in workspace. Complete onboarding first.");
      return;
    }
    if (activeDevices.length === 0) {
      addLog("error", "No enabled devices to simulate.");
      return;
    }

    const telemetry = buildTelemetryBatch();

    setRecords((prev) => {
      const next = telemetry.map((row) => {
        const src = devices.find((d) => d.id === row.device_id);
        return {
          id: `${row.device_id}-${row.ts}`,
          ts: row.ts,
          device_id: row.device_id,
          device_type: src?.type || "unknown",
          metric: row.metric,
          reading: Number(row.reading),
          values: (row.values || {}) as Record<string, number>,
        } as TelemetryRecord;
      });
      return [...next, ...prev].slice(0, 600);
    });

    setIsSending(true);
    try {
      const response = await api.post("/gateway-telemetry/", {
        gateway_id: gatewayId,
        telemetry,
      });

      const mlInference = response?.data?.ml_inference;

      const prediction = mlInference?.prediction;
      if (prediction) {
        const deltas = prediction.deltas || {};
        const summary = prediction.is_anomaly ? "Leak detected" : "No leak detected";
        addLog(
          prediction.is_anomaly ? "error" : "success",
          `ML prediction: ${summary} | FlowΔ=${typeof deltas.flow_delta === "number" ? deltas.flow_delta.toFixed(2) : "N/A"} | PressureΔ=${typeof deltas.pressure_delta === "number" ? deltas.pressure_delta.toFixed(2) : "N/A"}`,
          "pipeline"
        );
      } else if (mlInference?.error) {
        addLog("error", `ML inference failed: ${mlInference.error}`, "pipeline");
      }

      await fetchWorkspace();
    } catch (error: any) {
      const details =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        "Unknown telemetry error";
      addLog("error", `Telemetry push failed: ${details}`);
    } finally {
      setIsSending(false);
    }
  };

  const startSimulation = () => {
    const safeInterval = clamp(Number(intervalSec || 8), 5, 10);
    setIntervalSec(safeInterval);
    if (timerRef.current) window.clearInterval(timerRef.current);
    simulationStartMsRef.current = Date.now();
    setIsRunning(true);
    addLog("info", "Telemetry started.");
    pushOnce();
    timerRef.current = window.setInterval(pushOnce, safeInterval * 1000);
  };

  const stopSimulation = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    addLog("info", "Streaming stopped.");
  };

  useEffect(() => {
    if (autoStartArmedRef.current) return;
    if (isRunning || isSending) return;
    if (!gatewayId || activeDevices.length === 0) return;

    const t = window.setTimeout(() => {
      if (!autoStartArmedRef.current && !isRunning) {
        autoStartArmedRef.current = true;
        startSimulation();
      }
    }, 5000);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayId, activeDevices.length, isRunning, isSending]);

  const subpages: Array<{ id: SimPage; label: string }> = [
    { id: "pipeline", label: "Pipeline Data" },
    { id: "soil", label: "Soil Salinity" },
    { id: "demand", label: "Demand Forecasting" },
    { id: "water", label: "Water Quality" },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Telemetry Simulation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-streams all gateway devices and shows segmented telemetry consoles by module.
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium">Interval (seconds)</label>
            <input
              type="number"
              min={5}
              max={10}
              value={intervalSec}
              onChange={(e) => setIntervalSec(clamp(Number(e.target.value || 8), 5, 10))}
              className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
            <Button onClick={startSimulation} disabled={isRunning || isSending || !gatewayId || activeDevices.length === 0}>
              Start
            </Button>
            <Button variant="outline" onClick={stopSimulation} disabled={!isRunning}>
              Stop
            </Button>
            <Button variant="secondary" onClick={pushOnce} disabled={isSending || !gatewayId || activeDevices.length === 0}>
              Send Once
            </Button>
            <Button variant="ghost" onClick={() => setLogs([])} disabled={logs.length === 0}>
              Clear Console
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
          {filteredRecords.length === 0 ? (
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
                    <th className="text-left p-2">Values</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-2 font-mono">{new Date(row.ts).toLocaleTimeString()}</td>
                      <td className="p-2">{row.device_type}</td>
                      <td className="p-2 font-mono">{row.device_id}</td>
                      <td className="p-2">{row.metric}</td>
                      <td className="p-2">{row.reading}</td>
                      <td className="p-2 font-mono">{JSON.stringify(row.values)}</td>
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
