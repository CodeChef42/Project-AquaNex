import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import api from "@/lib/api";

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

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
};

// Helper functions
const randomAround = (base: number, span: number) =>
  Number((base + (Math.random() * 2 - 1) * span).toFixed(3));

const inferMetric = (device: any) => {
  const knownMetric = String(device?.metric || "").trim();
  if (knownMetric) return knownMetric;
  const lowerType = String(device?.type || "").toLowerCase();
  if (lowerType.includes("pressure")) return "pressure_bar";
  if (lowerType.includes("flow")) return "q_m3h";
  if (lowerType.includes("salinity")) return "ec_ds_m";
  if (lowerType.includes("soil")) return "soil_moisture_pct";
  if (lowerType.includes("ph")) return "ph";
  return "value";
};

const inferSensorIndex = (device: any) => {
  const descriptor = `${device?.id || ""} ${device?.type || ""} ${device?.metric || ""}`.toLowerCase();
  if (/(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(descriptor)) return 1;
  if (/(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(descriptor)) return 2;
  return null;
};

const metricGroup = (metric: string, type = "") => {
  const metricKey = String(metric || "").toLowerCase();
  const typeKey = String(type || "").toLowerCase();
  if (["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metricKey) || typeKey.includes("flow")) return "flow";
  if (["pressure_bar", "pressure"].includes(metricKey) || typeKey.includes("pressure")) return "pressure";
  return "other";
};

const LOGS_STORAGE_KEY = "aquanex_sim_logs";
const RECORDS_STORAGE_KEY = "aquanex_sim_records";

const safeParseJsonArray = <T,>(value: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const computePipelineDeltas = (telemetry: Array<{ metric: string; reading: number; device_id: string; device_type?: string }>) => {
  let flowUp: number | null = null;
  let flowDown: number | null = null;
  let pressureUp: number | null = null;
  let pressureDown: number | null = null;

  telemetry.forEach((row) => {
    // Basic check for pipeline related metrics
    const metric = String(row.metric || "").toLowerCase();
    const isFlow = ["q_m3h", "flow_lpm", "flow", "flow_rate"].includes(metric);
    const isPressure = ["pressure_bar", "pressure"].includes(metric);
    
    if (!isFlow && !isPressure) return;

    // We can infer index from ID if we had the device object, but here we just have telemetry row.
    // However, we need to know WHICH one is Upstream/Downstream.
    // The telemetry generation loop knows the mapping.
    // But here we are outside the loop's scope.
    // We can try to re-infer from device_id if it contains "01" or "02".
    const idx = inferSensorIndex({ id: row.device_id, type: "", metric: row.metric });
    
    if (isFlow && idx) {
      if (idx === 1) flowUp = Number(row.reading);
      if (idx === 2) flowDown = Number(row.reading);
    }
    if (isPressure && idx) {
      if (idx === 1) pressureUp = Number(row.reading);
      if (idx === 2) pressureDown = Number(row.reading);
    }
  });

  return {
    flow: flowUp !== null && flowDown !== null ? Math.abs(flowUp - flowDown) : null,
    pressure: pressureUp !== null && pressureDown !== null ? Math.abs(pressureUp - pressureDown) : null,
  };
};

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const { workspace } = useAuth();
  const [phase, setPhase] = useState<"Normal" | "Leak" | "Breakage">("Normal");
  const [cycleTime, setCycleTime] = useState(0);
  const [latestReadings, setLatestReadings] = useState<Record<string, number>>({});
  const [records, setRecords] = useState<TelemetryRecord[]>(() => safeParseJsonArray<TelemetryRecord>(localStorage.getItem(RECORDS_STORAGE_KEY)));
  const [logs, setLogs] = useState<LogRow[]>(() => safeParseJsonArray<LogRow>(localStorage.getItem(LOGS_STORAGE_KEY)));
  
  const latestReadingsRef = useRef<Record<string, number>>({});
  const sendingRef = useRef(false);

  // Sync state with localStorage
  const [isRunning, setIsRunning] = useState(localStorage.getItem("aquanex_sim_running") === "true");

  const addLog = (level: LogRow["level"], message: string, page: LogRow["page"] = "system") => {
    const entry: LogRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toLocaleTimeString(),
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

  const startSimulation = () => {
    localStorage.setItem("aquanex_sim_running", "true");
    setIsRunning(true);
    if (!localStorage.getItem("aquanex_sim_started_at")) {
        localStorage.setItem("aquanex_sim_started_at", String(Date.now()));
    }
    addLog("info", "Simulation started", "system");
  };

  const stopSimulation = () => {
    localStorage.setItem("aquanex_sim_running", "false");
    setIsRunning(false);
    addLog("info", "Simulation stopped", "system");
  };

  const clearLogs = () => {
    setLogs([]);
    localStorage.setItem(LOGS_STORAGE_KEY, "[]");
  };

  const clearRecords = () => {
    setRecords([]);
    localStorage.setItem(RECORDS_STORAGE_KEY, "[]");
  };

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const running = localStorage.getItem("aquanex_sim_running") === "true";
      if (!running) {
        if (isRunning) setIsRunning(false);
        return;
      }
      if (!isRunning) setIsRunning(true);
      if (sendingRef.current) return;

      const gatewayId = String(workspace?.gateway_id || "").trim();
      const devices = Array.isArray(workspace?.devices) ? workspace.devices : [];
      if (!gatewayId || devices.length === 0) return;

      const now = Date.now();
      const intervalSec = Math.max(60, Math.min(120, Number(localStorage.getItem("aquanex_sim_interval_sec") || 60))); 
      const lastPushTs = Number(localStorage.getItem("aquanex_sim_last_push_at") || 0);
      
      // Simulation Cycle Logic (Looping every 90 seconds)
      let startedAt = Number(localStorage.getItem("aquanex_sim_started_at") || 0);
      if (!Number.isFinite(startedAt) || startedAt <= 0) {
        startedAt = now;
        localStorage.setItem("aquanex_sim_started_at", String(startedAt));
      }
      
      const CYCLE_DURATION = 90000; // 90 seconds loop
      const elapsedMs = now - startedAt;
      const currentCycleTime = elapsedMs % CYCLE_DURATION;
      
      let currentPhase: "Normal" | "Leak" | "Breakage" = "Normal";
      if (currentCycleTime >= 20000 && currentCycleTime < 40000) {
        currentPhase = "Leak";
      } else if (currentCycleTime >= 40000 && currentCycleTime < 60000) {
        currentPhase = "Breakage";
      }
      
      setPhase(currentPhase);
      setCycleTime(currentCycleTime);

      // Only push to backend if interval elapsed
      const shouldPush = (now - lastPushTs) >= (intervalSec * 1000);

      const flowFallbackIndexById = new Map<string, number>();
      const pressureFallbackIndexById = new Map<string, number>();
      
      const flowCandidates = devices
        .filter((d: any) => metricGroup(inferMetric(d), d?.type || "") === "flow")
        .sort((a: any, b: any) => String(a?.id || "").localeCompare(String(b?.id || "")));
      const pressureCandidates = devices
        .filter((d: any) => metricGroup(inferMetric(d), d?.type || "") === "pressure")
        .sort((a: any, b: any) => String(a?.id || "").localeCompare(String(b?.id || "")));
        
      flowCandidates.forEach((d: any, idx: number) => flowFallbackIndexById.set(String(d?.id || ""), (idx % 2) + 1));
      pressureCandidates.forEach((d: any, idx: number) => pressureFallbackIndexById.set(String(d?.id || ""), (idx % 2) + 1));

      const ts = new Date().toISOString();
      const telemetry = devices.map((device: any) => {
        const metric = inferMetric(device);
        const group = metricGroup(metric, device?.type || "");
        
        let sensorIndex = inferSensorIndex(device);
        if (!sensorIndex) {
          if (group === "flow") sensorIndex = flowFallbackIndexById.get(String(device?.id || "")) ?? 1;
          else if (group === "pressure") sensorIndex = pressureFallbackIndexById.get(String(device?.id || "")) ?? 1;
          else sensorIndex = 1;
        }

        const prev = latestReadingsRef.current[device.id];
        let reading = 0;

        // --- CORE LOGIC: Force Large Deltas ---
        if (group === "flow") {
          if (currentPhase === "Normal") {
            reading = randomAround(50, 1.5);
          } else if (currentPhase === "Leak") {
            // Leak: Upstream ~65, Downstream ~35 -> Delta ~30
            if (sensorIndex === 1) reading = randomAround(65, 2);
            else reading = randomAround(35, 2);
          } else if (currentPhase === "Breakage") {
            // Breakage: Upstream ~85, Downstream ~10 -> Delta ~75
            if (sensorIndex === 1) reading = randomAround(85, 3);
            else reading = randomAround(10, 3);
          }
        } else if (group === "pressure") {
          if (currentPhase === "Normal") {
            reading = randomAround(4.0, 0.1);
          } else if (currentPhase === "Leak") {
            // Leak: Upstream ~4.2, Downstream ~2.5
            if (sensorIndex === 1) reading = randomAround(4.2, 0.1);
            else reading = randomAround(2.5, 0.1);
          } else if (currentPhase === "Breakage") {
            // Breakage: Upstream ~4.5, Downstream ~0.5
            if (sensorIndex === 1) reading = randomAround(4.5, 0.2);
            else reading = randomAround(0.5, 0.1);
          }
        } else {
           reading = prev ?? randomAround(50, 2);
        }
        
        if (reading < 0) reading = 0;
        latestReadingsRef.current[device.id] = reading;

        return {
          device_id: device.id,
          mcu_id: device.microcontroller_id,
          lat: device.lat,
          lng: device.lng,
          metric,
          reading,
          values: { [metric]: reading },
          ts,
          device_type: String(device?.type || ""),
        };
      });
      
      setLatestReadings({...latestReadingsRef.current});

      if (shouldPush) {
        sendingRef.current = true;
        try {
          const response = await api.post("/gateway-telemetry/", {
            gateway_id: gatewayId,
            telemetry,
            prefer_sync_ml: true,
          });
          localStorage.setItem("aquanex_sim_last_push_at", String(Date.now()));

          // --- LOGGING ---
          const mlInference = response?.data?.ml_inference;
          const prediction = mlInference?.prediction;
          const localDeltas = computePipelineDeltas(telemetry);

          if (prediction) {
            const deltas = prediction.deltas || {};
            const summary = prediction.is_anomaly ? "Leak detected" : "No leak detected";
            addLog(
              prediction.is_anomaly ? "error" : "success",
              `ML prediction: ${summary} | FlowΔ=${typeof deltas.flow_delta === "number" ? deltas.flow_delta.toFixed(2) : localDeltas.flow !== null ? localDeltas.flow?.toFixed(2) : "N/A"} | PressureΔ=${typeof deltas.pressure_delta === "number" ? deltas.pressure_delta.toFixed(2) : localDeltas.pressure !== null ? localDeltas.pressure?.toFixed(2) : "N/A"}`,
              "pipeline"
            );
          } else if (mlInference?.error) {
            addLog("error", `ML Error: ${mlInference.error}`, "pipeline");
          }

          addRecords(
            telemetry.map((row: any) => ({
              id: `${row.device_id}-${row.ts}`,
              ts: row.ts,
              device_id: row.device_id,
              device_type: String(row.device_type || ""),
              metric: String(row.metric || ""),
              reading: Number(row.reading),
              values: (row.values || {}) as Record<string, number>,
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
  }, [workspace]);

  return (
    <SimulationContext.Provider value={{ isRunning, phase, cycleTime, latestReadings, records, logs, startSimulation, stopSimulation, clearLogs, clearRecords }}>
      {children}
    </SimulationContext.Provider>
  );
};
