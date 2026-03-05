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
  lat: number | null;
  lng: number | null;
  status: string;
  metric: string;
  reading: number | string;
  last_seen: string;
};

type LogRow = {
  id: string;
  ts: string;
  level: "info" | "success" | "error";
  message: string;
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

const inferMetric = (device: WorkspaceDevice) => {
  const knownMetric = String(device.metric || "").trim();
  if (knownMetric) return knownMetric;
  const lowerType = String(device.type || "").toLowerCase();
  if (lowerType.includes("pressure")) return "pressure_bar";
  if (lowerType.includes("flow")) return "q_m3h";
  if (lowerType.includes("ph")) return "ph";
  if (lowerType.includes("soil")) return "soil_moisture_pct";
  return "value";
};

const inferFamily = (device: WorkspaceDevice, metric: string) => {
  const metricKey = String(metric || "").toLowerCase();
  if (["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metricKey)) return "flow";
  if (["pressure_bar", "pressure"].includes(metricKey)) return "pressure";
  const typeKey = String(device.type || "").toLowerCase();
  if (typeKey.includes("flow")) return "flow";
  if (typeKey.includes("pressure")) return "pressure";
  return null;
};

const inferSensorIndex = (device: WorkspaceDevice) => {
  const descriptor = `${device.id} ${device.type} ${device.metric}`.toLowerCase();
  if (/(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(descriptor)) return 1;
  if (/(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(descriptor)) return 2;
  return null;
};

const valueForMetric = (metric: string, previous?: number) => {
  if (metric === "q_m3h" || metric === "flow_lpm" || metric === "flow") {
    return randomAround(previous ?? 18, 3);
  }
  if (metric === "pressure_bar" || metric === "pressure") {
    return randomAround(previous ?? 3.2, 0.4);
  }
  if (metric === "ph") {
    return randomAround(previous ?? 7.2, 0.2);
  }
  if (metric === "soil_moisture_pct") {
    return randomAround(previous ?? 42, 4);
  }
  return randomAround(previous ?? 50, 5);
};

const summarizeDeltas = (
  rows: Array<{ device_id: string; metric: string; reading: number; device_type?: string }>
) => {
  let flow1: number | null = null;
  let flow2: number | null = null;
  let pressure1: number | null = null;
  let pressure2: number | null = null;

  rows.forEach((row) => {
    const metric = String(row.metric || "").toLowerCase();
    const id = String(row.device_id || "").toLowerCase();
    const deviceType = String(row.device_type || "").toLowerCase();
    const reading = Number(row.reading);
    if (!Number.isFinite(reading)) return;

    const isFlow =
      ["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metric) || deviceType.includes("flow");
    const isPressure = ["pressure_bar", "pressure"].includes(metric) || deviceType.includes("pressure");
    const index =
      /(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(id)
        ? 1
        : /(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(id)
        ? 2
        : null;
    if (!index) return;

    if (isFlow) {
      if (index === 1) flow1 = reading;
      if (index === 2) flow2 = reading;
    }
    if (isPressure) {
      if (index === 1) pressure1 = reading;
      if (index === 2) pressure2 = reading;
    }
  });

  const flowDelta = flow1 !== null && flow2 !== null ? Math.abs(flow1 - flow2) : null;
  const pressureDelta = pressure1 !== null && pressure2 !== null ? Math.abs(pressure1 - pressure2) : null;
  return { flowDelta, pressureDelta };
};

const Simulation = () => {
  const navigate = useNavigate();
  const { workspace, fetchWorkspace } = useAuth();
  const [deviceEnabled, setDeviceEnabled] = useState<Record<string, boolean>>({});
  const [intervalSec, setIntervalSec] = useState(8);
  const [isRunning, setIsRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const latestValuesRef = useRef<Record<string, number>>({});
  const timerRef = useRef<number | null>(null);
  const simulationStartMsRef = useRef<number | null>(null);

  const gatewayId = String(workspace?.gateway_id || "").trim();
  const devices = useMemo<WorkspaceDevice[]>(
    () => (Array.isArray(workspace?.devices) ? (workspace?.devices as WorkspaceDevice[]) : []),
    [workspace?.devices]
  );
  const activeDevices = useMemo(
    () => devices.filter((d) => deviceEnabled[d.id] !== false),
    [deviceEnabled, devices]
  );

  const addLog = (level: LogRow["level"], message: string) => {
    const entry: LogRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 250));
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
    const startMs = simulationStartMsRef.current;
    const elapsedMs = Date.now() - startMs;
    const cyclePosMs = elapsedMs % 30000;
    const anomalyMode = cyclePosMs >= 15000;
    return activeDevices.map((device) => {
      const metric = inferMetric(device);
      const prev = latestValuesRef.current[device.id];
      const family = inferFamily(device, metric);
      const sensorIndex = inferSensorIndex(device);

      let reading = valueForMetric(metric, prev);
      if (anomalyMode && family && sensorIndex) {
        if (family === "flow") {
          reading = sensorIndex === 1 ? 55 : 10;
        } else if (family === "pressure") {
          reading = sensorIndex === 1 ? randomAround(4.4, 0.15) : randomAround(1.0, 0.15);
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
        values: {
          [metric]: reading,
        },
        ts,
      };
    }).map((row) => ({ ...row, __anomalyMode: anomalyMode }));
  };

  const pushOnce = async () => {
    if (!gatewayId) {
      addLog("error", "No gateway is saved in workspace. Complete onboarding step 5 first.");
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
      return [...next, ...prev].slice(0, 300);
    });
    setIsSending(true);
    try {
      const summarized = summarizeDeltas(
        telemetry.map(({ device_id, metric, reading }) => ({
          device_id,
          metric,
          reading: Number(reading),
          device_type: devices.find((d) => d.id === device_id)?.type,
        }))
      );
      const response = await api.post("/gateway-telemetry/", {
        gateway_id: gatewayId,
        telemetry: telemetry.map(({ __anomalyMode, ...row }: any) => row),
      });
      const mlInference = response?.data?.ml_inference;
      const anomalies = Array.isArray(response?.data?.anomalies) ? response.data.anomalies : [];
      const prediction = mlInference?.prediction;
      if (prediction) {
        const deltas = prediction.deltas || {};
        const isAnomaly = prediction.is_anomaly;
        const status = isAnomaly ? "ANOMALY" : "NORMAL";
        const flowDelta = typeof deltas.flow_delta === "number" ? deltas.flow_delta.toFixed(2) : "N/A";
        const pressureDelta = typeof deltas.pressure_delta === "number" ? deltas.pressure_delta.toFixed(2) : "N/A";
        const level = isAnomaly ? "error" : "success";
        addLog(level, `[${status}] ΔFlow: ${flowDelta}, ΔPressure: ${pressureDelta}`);
      } else if (mlInference?.error) {
        addLog("error", "Telemetry inference failed");
      } else {
        const flowDelta = summarized.flowDelta;
        const pressureDelta = summarized.pressureDelta;
        const fallbackAnomaly =
          anomalies.length > 0 ||
          (typeof flowDelta === "number" && flowDelta >= 20) ||
          (typeof pressureDelta === "number" && pressureDelta >= 1.2);
        const status = fallbackAnomaly ? "ANOMALY" : "NORMAL";
        const level = fallbackAnomaly ? "error" : "success";
        addLog(
          level,
          `[${status}] ΔFlow: ${typeof flowDelta === "number" ? flowDelta.toFixed(2) : "N/A"}, ΔPressure: ${typeof pressureDelta === "number" ? pressureDelta.toFixed(2) : "N/A"}`
        );
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
    pushOnce();
    timerRef.current = window.setInterval(pushOnce, safeInterval * 1000);
  };

  const stopSimulation = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Telemetry Simulation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate gateway-device telemetry into AquaNex using your saved onboarding inventory.
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
            <Button
              variant="ghost"
              onClick={() => setLogs([])}
              disabled={logs.length === 0}
            >
              Clear Console
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device List</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No devices found. Complete onboarding step 5 and confirm devices first.
            </p>
          ) : (
            <div className="rounded-xl border border-border divide-y">
              {devices.map((device) => (
                <div key={device.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold">{device.id}</p>
                    <p className="text-muted-foreground">
                      {device.type} • MCU: {device.microcontroller_id}
                    </p>
                    <p className="text-muted-foreground">
                      Metric: {inferMetric(device)} • Coords:{" "}
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
          <CardTitle>Live Telemetry Records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No records yet. Click Start or Send Once.
            </p>
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
                  {records.map((row) => (
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
          <CardTitle>Simulation Console</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-black text-green-200 font-mono text-xs h-80 overflow-auto p-3 space-y-2">
            {logs.length === 0 ? (
              <p className="text-green-400/80">No events yet. Start simulation or send once.</p>
            ) : (
              logs.map((log) => (
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
