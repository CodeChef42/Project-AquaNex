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
type SimState = "NORMAL" | "LEAK_ACTIVE" | "BREAKAGE_ACTIVE";
type StickyPrediction = {
  active: boolean;
  label: string;
  anomalyType?: "turbidity" | "ph" | "ec";
};
type PipelineStickyPrediction = {
  active: boolean;
  label: "Leak" | "Breakage" | "";
};

// ── Constants ──────────────────────────────────────────────────────────────────
const LOGS_STORAGE_KEY    = "aquanex_sim_logs";
const RECORDS_STORAGE_KEY = "aquanex_sim_records";
const NORMAL_MIN_MS       = 30_000; // 30s normal before triggering anomaly

// ── Helpers ────────────────────────────────────────────────────────────────────
const randomAround = (base: number, span: number) =>
  Number((base + (Math.random() * 2 - 1) * span).toFixed(3));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
  const wqPredictionRef     = useRef<StickyPrediction>({ active: false, label: "" });
  const soilPredictionRef   = useRef<StickyPrediction>({ active: false, label: "" });
  const pipelinePredictionRef = useRef<PipelineStickyPrediction>({ active: false, label: "" });
  const soilWarmupPushesRef = useRef(0);
  const wqWarmupPushesRef   = useRef(0);

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
    wqPredictionRef.current     = { active: false, label: "" };
    soilPredictionRef.current   = { active: false, label: "" };
    pipelinePredictionRef.current = { active: false, label: "" };
    soilWarmupPushesRef.current = 0;
    wqWarmupPushesRef.current   = 0;
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
      const intervalSec = 10;
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
        pipelinePredictionRef.current = {
          active: true,
          label: currentState === "LEAK_ACTIVE" ? "Leak" : "Breakage",
        };
        addLog(
          "error",
          `⚠️ Anomaly triggered: ${currentState === "LEAK_ACTIVE" ? "Leak" : "Breakage"} — anomalous readings will continue until resolved in DB`,
          "pipeline"
        );
      }

      // Keep anomaly sticky once detected; no auto-resolve/recovery transition.

      // Sync phase badge to UI
      const phaseMap: Record<SimState, "Normal" | "Leak" | "Breakage"> = {
        NORMAL:           "Normal",
        LEAK_ACTIVE:      "Leak",
        BREAKAGE_ACTIVE:  "Breakage",
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
      const ts = new Date().toISOString();
      const isWqDevice = (device: any) => {
        const t = String(device?.type || "").toLowerCase();
        return t.includes("ph_sensor") || t.includes("turbidity_sensor") ||
               t === "ph" || t === "turbidity";
      };
      const isSoilSalinityDevice = (device: any, metric: string) => {
        const t = String(device?.type || "").toLowerCase();
        const m = String(metric || "").toLowerCase();
        return t.includes("salinity") || t.includes("ec") || m === "ec_ds_m" || m === "ec_ms_cm";
      };

      const telemetry = devices.map((device: any) => {
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
          if      (currentState === "NORMAL")   reading = randomAround(50, 1.5);
          else if (currentState === "LEAK_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(65, 2)  : randomAround(35, 2);
          else if (currentState === "BREAKAGE_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(85, 3)  : randomAround(10, 3);

        } else if (group === "pressure") {
          if      (currentState === "NORMAL")   reading = randomAround(4.0, 0.1);
          else if (currentState === "LEAK_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(4.2, 0.1) : randomAround(2.5, 0.1);
          else if (currentState === "BREAKAGE_ACTIVE")
            reading = sensorIndex === 1 ? randomAround(4.5, 0.2) : randomAround(0.5, 0.1);

        } else if (isWqDevice(device) || group === "water") {
          const typeKey = String(device?.type || "").toLowerCase();
          const wqAnomalyActive = wqPredictionRef.current.active;
          const wqAnomalyType = wqPredictionRef.current.anomalyType;
          if (typeKey.includes("ph") || metric.toLowerCase() === "ph") {
            if (wqAnomalyActive && wqAnomalyType === "ph") {
              reading = randomAround(5.6, 0.25);
            } else {
              reading = randomAround(7.0, 0.25);
            }
            reading = clamp(reading, 4.5, 9.5);
          } else if (typeKey.includes("turbidity") || metric.toLowerCase() === "turbidity") {
            if (wqAnomalyActive && wqAnomalyType === "turbidity") {
              reading = randomAround(11.5, 1.8);
            } else {
              reading = randomAround(2.0, 0.8);
            }
            reading = clamp(reading, 0.1, 20);
          } else {
            reading = randomAround(reading || 7, 1.5);
          }
        } else if (isSoilSalinityDevice(device, metric)) {
          const warmup = soilWarmupPushesRef.current < 2;
          if (warmup) {
            reading = randomAround(2.4, 0.25); // normal EC first few pushes
          } else {
            reading = randomAround(7.6, 0.45); // sustained high EC afterwards
          }
          reading = clamp(reading, 1.5, 10.5);
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
        soilWarmupPushesRef.current += 1;
        wqWarmupPushesRef.current += 1;

        // Always stream Water Quality dummy values to console regardless of backend telemetry state.
        const dummyWqRows = [
          {
            device_id: "AQN-PH-01",
            device_type: "ph_sensor",
            metric: "ph",
            reading: clamp(randomAround(7.4, 0.45), 4.5, 9.5),
            ts,
          },
          {
            device_id: "AQN-TB-01",
            device_type: "turbidity_sensor",
            metric: "turbidity_ntu",
            reading: clamp(randomAround(8.8, 2.2), 0.1, 20),
            ts,
          },
        ];
        dummyWqRows.forEach((row) => {
          addLog("info", `WQ Prediction: ${row.device_id} ${row.metric}=${Number(row.reading).toFixed(2)}`, "water");
        });
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
          const mlInference = response?.data?.ml_inference || response?.data?.ml;
          const prediction  = mlInference?.prediction;
          const localDeltas = computePipelineDeltas(telemetry);

          if (prediction) {
            const deltas  = prediction.deltas || {};
            const anomalyStateActive = currentState === "LEAK_ACTIVE" || currentState === "BREAKAGE_ACTIVE";
            const stickyLabel = pipelinePredictionRef.current.active ? pipelinePredictionRef.current.label : "";
            const summary = anomalyStateActive
              ? (stickyLabel || (currentState === "BREAKAGE_ACTIVE" ? "Breakage" : "Leak"))
              : (prediction.is_anomaly ? (currentState === "BREAKAGE_ACTIVE" ? "Breakage" : "Leak") : "Normal");
            const isAnomalyLog = anomalyStateActive || Boolean(prediction.is_anomaly);
            addLog(
              isAnomalyLog ? "error" : "success",
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
          } else {
            // Keep pipeline stream alive even when backend ML response is delayed/missing.
            const anomalyStateActive = currentState === "LEAK_ACTIVE" || currentState === "BREAKAGE_ACTIVE";
            const fallbackSummary = anomalyStateActive
              ? (pipelinePredictionRef.current.label || (currentState === "BREAKAGE_ACTIVE" ? "Breakage" : "Leak"))
              : "Normal";
            addLog(
              anomalyStateActive ? "error" : "success",
              `ML: ${fallbackSummary} | State=${currentState} | FlowΔ=${localDeltas.flow?.toFixed(2) ?? "N/A"} | PressureΔ=${localDeltas.pressure?.toFixed(2) ?? "N/A"} (rule fallback)`,
              "pipeline"
            );
          }

          // Water quality anomaly/model logs
          const anomalies = Array.isArray(response?.data?.anomalies) ? response.data.anomalies : [];
          anomalies
            .filter((a: any) => String(a?.source || "").includes("water_quality"))
            .forEach((a: any) => {
              const level: LogRow["level"] =
                String(a?.severity || "").toLowerCase() === "critical" ? "error" : "info";
              addLog(
                level,
                `WQ Model: ${String(a?.metric || "metric")} on ${String(a?.device_id || "device")} (${String(a?.reason || "threshold")})`,
                "water"
              );
            });

          telemetry
            .filter((row: any) => {
              const t = String(row.device_type || "").toLowerCase();
              const m = String(row.metric || "").toLowerCase();
              return t.includes("ph") || t.includes("turbidity") || m === "ph" || m === "turbidity";
            })
            .forEach((row: any) => {
              addLog(
                "info",
                `WQ Telemetry: ${row.device_id} ${row.metric}=${Number(row.reading).toFixed(2)}`,
                "water"
              );
            });

          // Sticky rule-based Water Quality prediction (streams one prediction until resolved)
          const wqRows = [
            ...telemetry.filter((row: any) => {
              const m = String(row.metric || "").toLowerCase();
              const t = String(row.device_type || "").toLowerCase();
              return m === "ph" || m === "turbidity" || t.includes("ph") || t.includes("turbidity");
            }),
            ...dummyWqRows,
          ];
          const maxTurbidity = wqRows
            .filter((r: any) => String(r.metric || "").toLowerCase().includes("turbidity"))
            .reduce((acc: number, r: any) => Math.max(acc, Number(r.reading) || 0), 0);
          const phValues = wqRows
            .filter((r: any) => String(r.metric || "").toLowerCase() === "ph")
            .map((r: any) => Number(r.reading))
            .filter((v: number) => Number.isFinite(v));
          const minPh = phValues.length ? Math.min(...phValues) : null;
          const maxPh = phValues.length ? Math.max(...phValues) : null;

          if (!wqPredictionRef.current.active && wqRows.length > 0 && wqWarmupPushesRef.current >= 2) {
            const anomalyType: "turbidity" | "ph" = Math.random() < 0.5 ? "turbidity" : "ph";
            wqPredictionRef.current = anomalyType === "turbidity"
              ? { active: true, anomalyType, label: "Anomaly detected: Increase turbidity / low quality water" }
              : { active: true, anomalyType, label: "Anomaly detected: Dangerous pH / low quality water" };
          }
          if (wqPredictionRef.current.active && wqPredictionRef.current.label) {
            addLog("error", `WQ Rule-ML: ${wqPredictionRef.current.label}`, "water");
          }

          // Sticky rule-based Soil Salinity prediction (normal warmup then high EC)
          const soilRows = telemetry.filter((row: any) => {
            const m = String(row.metric || "").toLowerCase();
            const t = String(row.device_type || "").toLowerCase();
            return m === "ec_ds_m" || m === "ec_ms_cm" || t.includes("salinity") || t.includes("ec");
          });
          if (soilRows.length > 0) {
            const avgEc = soilRows.reduce((acc: number, r: any) => acc + (Number(r.reading) || 0), 0) / soilRows.length;
            if (!soilPredictionRef.current.active && soilWarmupPushesRef.current < 2) {
              soilPredictionRef.current = { active: true, label: "Prediction: Normal EC levels" };
            }
            if (soilWarmupPushesRef.current >= 2) {
              soilPredictionRef.current = { active: true, anomalyType: "ec", label: "Anomaly detected: High EC salinity risk" };
            }
            const soilIssue = soilPredictionRef.current.label.toLowerCase().includes("anomaly detected");
            addLog(
              soilIssue ? "error" : "success",
              `Soil Rule-ML: ${soilPredictionRef.current.label} | Avg EC=${avgEc.toFixed(2)} dS/m`,
              "soil"
            );
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
