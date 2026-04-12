import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
export type LogRow = {
  id: string;
  ts: string;
  level: "info" | "success" | "error";
  message: string;
  page: "pipeline" | "soil" | "demand" | "water" | "system";
};

export type TelemetryRecord = {
  id: string;
  ts: string;
  device_id: string;
  device_type: string;
  metric: string;
  reading: number;
  values: Record<string, number>;
};

interface SimulationContextType {
  isRunning: boolean;
  phase: "Normal" | "Leak" | "Breakage";
  cycleTime: number;
  latestReadings: Record<string, number>;
  records: TelemetryRecord[];
  logs: LogRow[];
  startSimulation: () => void;
  stopSimulation: () => void;
  clearLogs: () => void;
  clearRecords: () => void;
}

// ── State Machine Type ─────────────────────────────────────────────────────────
type SimState = "NORMAL" | "LEAK_ACTIVE" | "BREAKAGE_ACTIVE" | "RECOVERY";

// ── Constants ──────────────────────────────────────────────────────────────────
const LOGS_STORAGE_KEY    = "aquanex_sim_logs";
const RECORDS_STORAGE_KEY = "aquanex_sim_records";
const NORMAL_MIN_MS       = 30_000; // 30s normal before triggering anomaly
const RECOVERY_MIN_MS     = 20_000; // 20s recovery before returning to normal

// ── Helpers ────────────────────────────────────────────────────────────────────
const randomAround = (base: number, span: number) =>
  Number((base + (Math.random() * 2 - 1) * span).toFixed(3));

const inferMetric = (device: any): string => {
  const knownMetric = String(device?.metric || "").trim();
  if (knownMetric) return knownMetric;
  const lowerType = String(device?.type || "").toLowerCase();
  if (lowerType.includes("pressure")) return "pressure_bar";
  if (lowerType.includes("flow"))     return "q_m3h";
  if (lowerType.includes("salinity")) return "ec_ds_m";
  if (lowerType.includes("soil"))     return "soil_moisture_pct";
  if (lowerType.includes("ph"))       return "ph";
  return "value";
};

const inferSensorIndex = (device: any): number | null => {
  const descriptor = `${device?.id || ""} ${device?.type || ""} ${device?.metric || ""}`.toLowerCase();
  if (/(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(descriptor))   return 1;
  if (/(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(descriptor)) return 2;
  return null;
};

const metricGroup = (metric: string, type = ""): string => {
  const metricKey = String(metric || "").toLowerCase();
  const typeKey   = String(type   || "").toLowerCase();
  if (["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metricKey) || typeKey.includes("flow"))     return "flow";
  if (["pressure_bar", "pressure"].includes(metricKey)               || typeKey.includes("pressure")) return "pressure";
  return "other";
};

const safeParseJsonArray = <T,>(value: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const computePipelineDeltas = (
  telemetry: Array<{ metric: string; reading: number; device_id: string; device_type?: string }>
) => {
  let flowUp: number | null      = null;
  let flowDown: number | null    = null;
  let pressureUp: number | null  = null;
  let pressureDown: number | null = null;

  telemetry.forEach((row) => {
    const metric     = String(row.metric || "").toLowerCase();
    const isFlow     = ["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metric);
    const isPressure = ["pressure_bar", "pressure"].includes(metric);
    if (!isFlow && !isPressure) return;

    const idx = inferSensorIndex({ id: row.device_id, type: "", metric: row.metric });
    if (isFlow     && idx === 1) flowUp      = Number(row.reading);
    if (isFlow     && idx === 2) flowDown    = Number(row.reading);
    if (isPressure && idx === 1) pressureUp  = Number(row.reading);
    if (isPressure && idx === 2) pressureDown = Number(row.reading);
  });

  return {
    flow:     flowUp     !== null && flowDown     !== null ? Math.abs(flowUp     - flowDown)     : null,
    pressure: pressureUp !== null && pressureDown !== null ? Math.abs(pressureUp - pressureDown) : null,
  };
};

// ── Context ────────────────────────────────────────────────────────────────────
const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) throw new Error("useSimulation must be used within a SimulationProvider");
  return context;
};

// ── Provider ───────────────────────────────────────────────────────────────────
export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const { workspace } = useAuth();
  const workspaceRef  = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  const [isRunning, setIsRunning] = useState(false);
  useEffect(() => {
  localStorage.setItem("aquanex_sim_running", "false");
  }, []);
  const [phase,          setPhase]          = useState<"Normal" | "Leak" | "Breakage">("Normal");
  const [cycleTime,      setCycleTime]      = useState(0);
  const [latestReadings, setLatestReadings] = useState<Record<string, number>>({});
  const [records, setRecords] = useState<TelemetryRecord[]>(
    () => safeParseJsonArray<TelemetryRecord>(localStorage.getItem(RECORDS_STORAGE_KEY))
  );
  const [logs, setLogs] = useState<LogRow[]>(
    () => safeParseJsonArray<LogRow>(localStorage.getItem(LOGS_STORAGE_KEY))
  );

  // ── Refs ───────────────────────────────────────────────────────────────────
  const latestReadingsRef   = useRef<Record<string, number>>({});
  const sendingRef          = useRef(false);

  // State machine refs — persisted across ticks without re-render
  const simStateRef         = useRef<SimState>("NORMAL");
  const stateEnteredAtRef   = useRef<number>(Date.now());
  const activeIncidentIdRef = useRef<string | null>(null);
  const checkingIncidentRef = useRef(false); // prevents concurrent polls

  // ── Logging ────────────────────────────────────────────────────────────────
  const addLog = (level: LogRow["level"], message: string, page: LogRow["page"] = "system") => {
    const entry: LogRow = {
      id:      `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts:      new Date().toLocaleTimeString(),
      level,
      message,
      page,
    };
    setLogs((prev) => {
      const next = [entry, ...prev].slice(0, 300);
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const addRecords = (newRecords: TelemetryRecord[]) => {
    if (newRecords.length === 0) return;
    setRecords((prev) => {
      const next = [...newRecords, ...prev].slice(0, 1200);
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ── Controls ───────────────────────────────────────────────────────────────
  const startSimulation = () => {
    localStorage.setItem("aquanex_sim_running", "true");
    // Reset state machine on fresh start
    simStateRef.current       = "NORMAL";
    stateEnteredAtRef.current = Date.now();
    activeIncidentIdRef.current = null;
    setIsRunning(true);
    addLog("info", "▶ Simulation started — state machine reset to NORMAL", "system");
  };

  const stopSimulation = () => {
    localStorage.setItem("aquanex_sim_running", "false");
    setIsRunning(false);
    addLog("info", "⏹ Simulation stopped", "system");
  };

  const clearLogs    = () => { setLogs([]);    localStorage.setItem(LOGS_STORAGE_KEY,    "[]"); };
  const clearRecords = () => { setRecords([]); localStorage.setItem(RECORDS_STORAGE_KEY, "[]"); };

  // ── Main Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const running = localStorage.getItem("aquanex_sim_running") === "true";
      if (!running) {
        if (isRunning) setIsRunning(false);
        return;
      }
      if (!isRunning) setIsRunning(true);
      if (sendingRef.current) return;

      const gatewayId = String(workspaceRef.current?.gateway_id || "").trim();
      const devices   = Array.isArray(workspaceRef.current?.devices)
        ? workspaceRef.current!.devices as any[]
        : [];
      if (!gatewayId || devices.length === 0) return;

      const now         = Date.now();
      const intervalSec = Math.max(10, Math.min(120, Number(localStorage.getItem("aquanex_sim_interval_sec") || 60)));
      const lastPushTs  = Number(localStorage.getItem("aquanex_sim_last_push_at") || 0);
      const shouldPush  = now - lastPushTs >= intervalSec * 1000;
      const elapsed     = now - stateEnteredAtRef.current;

      // ── State Machine Transitions ────────────────────────────────────────
      let currentState = simStateRef.current;

      // NORMAL → anomaly after minimum normal window (30s)
      if (currentState === "NORMAL" && elapsed >= NORMAL_MIN_MS) {
        currentState = Math.random() < 0.6 ? "LEAK_ACTIVE" : "BREAKAGE_ACTIVE";
        simStateRef.current         = currentState;
        stateEnteredAtRef.current   = now;
        activeIncidentIdRef.current = null;
        addLog(
          "error",
          `⚠️ Anomaly triggered: ${currentState === "LEAK_ACTIVE" ? "Leak" : "Breakage"} — anomalous readings will continue until resolved in DB`,
          "pipeline"
        );
      }

      // ANOMALY ACTIVE → poll incident status (only if we have an ID captured from telemetry response)
      if (
        (currentState === "LEAK_ACTIVE" || currentState === "BREAKAGE_ACTIVE") &&
        activeIncidentIdRef.current &&
        !checkingIncidentRef.current
      ) {
        checkingIncidentRef.current = true;
        try {
          // Poll the specific incident detail endpoint
          const res = await api.get(`/incidents/${activeIncidentIdRef.current}/`);
          const status = String(res?.data?.status || "").toLowerCase();

          // Only exit anomaly phase when status is NOT "open"
          if (status && status !== "open") {
            currentState = "RECOVERY";
            simStateRef.current         = currentState;
            stateEnteredAtRef.current   = now;
            activeIncidentIdRef.current = null;
            addLog(
              "success",
              `✅ Incident Resolved (Status: ${status}) — anomaly readings stopped, entering recovery`,
              "pipeline"
            );
          }
        } catch (err: any) {
          // If 404, maybe incident was deleted or not yet synced, stay in anomaly
          if (err?.response?.status === 404) {
             // Optional: addLog("info", "Waiting for incident record to appear in DB...", "pipeline");
          }
        } finally {
          checkingIncidentRef.current = false;
        }
      }

      // RECOVERY → NORMAL after minimum recovery window (20s)
      if (currentState === "RECOVERY" && elapsed >= RECOVERY_MIN_MS) {
        currentState = "NORMAL";
        simStateRef.current       = currentState;
        stateEnteredAtRef.current = now;
        addLog("info", "🔄 System normalized — resuming regular telemetry", "pipeline");
      }

      // Sync phase badge to UI
      const phaseMap: Record<SimState, "Normal" | "Leak" | "Breakage"> = {
        NORMAL:           "Normal",
        LEAK_ACTIVE:      "Leak",
        BREAKAGE_ACTIVE:  "Breakage",
        RECOVERY:         "Normal",
      };
      setPhase(phaseMap[currentState]);
      setCycleTime(elapsed);

      // ── Fallback index maps ──────────────────────────────────────────────
      const flowFallbackIndexById     = new Map<string, number>();
      const pressureFallbackIndexById = new Map<string, number>();

      devices
        .filter((d) => metricGroup(inferMetric(d), d?.type || "") === "flow")
        .sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")))
        .forEach((d, i) => flowFallbackIndexById.set(String(d?.id || ""), (i % 2) + 1));

      devices
        .filter((d) => metricGroup(inferMetric(d), d?.type || "") === "pressure")
        .sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")))
        .forEach((d, i) => pressureFallbackIndexById.set(String(d?.id || ""), (i % 2) + 1));

      // ── Sensor Value Generation ──────────────────────────────────────────
      // WQ devices (ph_sensor, turbidity_sensor) are intentionally excluded —
      // they are fed by the standalone Python IoT simulator and must not be
      // overwritten with browser-generated placeholder values.
      const ts = new Date().toISOString();
      const isWqDevice = (device: any) => {
        const t = String(device?.type || "").toLowerCase();
        return t.includes("ph_sensor") || t.includes("turbidity_sensor") ||
               t === "ph" || t === "turbidity";
      };

      const telemetry = devices
        .filter((device: any) => !isWqDevice(device))
        .map((device: any) => {
        const metric = inferMetric(device);
        const group  = metricGroup(metric, device?.type || "");

        let sensorIndex = inferSensorIndex(device);
        if (!sensorIndex) {
          if      (group === "flow")     sensorIndex = flowFallbackIndexById.get(String(device?.id || "")) ?? 1;
          else if (group === "pressure") sensorIndex = pressureFallbackIndexById.get(String(device?.id || "")) ?? 1;
          else                           sensorIndex = 1;
        }

        let reading = latestReadingsRef.current[device.id] ?? 0;

        if (group === "flow") {
          // ⚠️ CRITICAL: normal values ONLY in NORMAL or RECOVERY — never during anomaly
          if      (currentState === "NORMAL"    || currentState === "RECOVERY")   reading = randomAround(50, 1.5);
          else if (currentState === "LEAK_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(65, 2)  : randomAround(35, 2);
          else if (currentState === "BREAKAGE_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(85, 3)  : randomAround(10, 3);

        } else if (group === "pressure") {
          if      (currentState === "NORMAL"    || currentState === "RECOVERY")   reading = randomAround(4.0, 0.1);
          else if (currentState === "LEAK_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(4.2, 0.1) : randomAround(2.5, 0.1);
          else if (currentState === "BREAKAGE_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(4.5, 0.2) : randomAround(0.5, 0.1);

        } else {
          // Generic non-WQ sensor — preserve last value with small noise
          reading = randomAround(reading || 0, 1);
        }

        if (reading < 0) reading = 0;
        latestReadingsRef.current[device.id] = reading;

        return {
          device_id:   device.id,
          mcu_id:      device.microcontroller_id,
          lat:         device.lat,
          lng:         device.lng,
          metric,
          reading,
          values:      { [metric]: reading },
          ts,
          device_type: String(device?.type || ""),
        };
      });

      setLatestReadings({ ...latestReadingsRef.current });

      // ── Push to Backend ──────────────────────────────────────────────────
      if (shouldPush) {
        sendingRef.current = true;
        try {
          const response = await api.post("/gateway-telemetry/", {
            gateway_id:     gatewayId,
            telemetry,
            prefer_sync_ml: true,
          });
          localStorage.setItem("aquanex_sim_last_push_at", String(Date.now()));

          // Capture incident ID from backend — try all common response shapes
          const incidentId =
            response?.data?.incident_id       ||
            response?.data?.incident?.id      ||
            response?.data?.ml_inference?.incident_id;

          if (
            incidentId &&
            !activeIncidentIdRef.current &&
            (currentState === "LEAK_ACTIVE" || currentState === "BREAKAGE_ACTIVE")
          ) {
            activeIncidentIdRef.current = String(incidentId);
            addLog(
              "info",
              `📋 Incident captured: ${incidentId} — polling /incidents/${incidentId}/ for resolution`,
              "pipeline"
            );
          }

          // ML logging
          const mlInference = response?.data?.ml_inference;
          const prediction  = mlInference?.prediction;
          const localDeltas = computePipelineDeltas(telemetry);

          if (prediction) {
            const deltas  = prediction.deltas || {};
            const summary = prediction.is_anomaly
              ? currentState === "BREAKAGE_ACTIVE" ? "Breakage" : "Leak"
              : "Normal";
            addLog(
              prediction.is_anomaly ? "error" : "success",
              `ML: ${summary} | State=${currentState} | FlowΔ=${
                typeof deltas.flow_delta === "number"
                  ? deltas.flow_delta.toFixed(2)
                  : localDeltas.flow?.toFixed(2) ?? "N/A"
              } | PressureΔ=${
                typeof deltas.pressure_delta === "number"
                  ? deltas.pressure_delta.toFixed(2)
                  : localDeltas.pressure?.toFixed(2) ?? "N/A"
              }`,
              "pipeline"
            );
          } else if (mlInference?.error) {
            addLog("error", `ML Error: ${mlInference.error}`, "pipeline");
          }

          addRecords(
            telemetry.map((row: any) => ({
              id:          `${row.device_id}-${row.ts}`,
              ts:          row.ts,
              device_id:   row.device_id,
              device_type: String(row.device_type || ""),
              metric:      String(row.metric || ""),
              reading:     Number(row.reading),
              values:      (row.values || {}) as Record<string, number>,
            }))
          );

        } catch (err: any) {
          console.error("Telemetry push failed", err);
          addLog("error", `Telemetry failed: ${err.message}`, "system");
        } finally {
          sendingRef.current = false;
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <SimulationContext.Provider
      value={{ isRunning, phase, cycleTime, latestReadings, records, logs, startSimulation, stopSimulation, clearLogs, clearRecords }}
    >
      {children}
    </SimulationContext.Provider>
  );
};