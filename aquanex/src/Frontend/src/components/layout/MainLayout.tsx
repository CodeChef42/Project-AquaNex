import { ReactNode, useEffect, useRef } from "react";
import GlobalHeader from "./GlobalHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  const { workspace } = useAuth();
  const showWorkspaceShell = location.pathname !== "/workspaces";
  const latestValuesRef = useRef<Record<string, number>>({});
  const sendingRef = useRef(false);

  useEffect(() => {
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

    const timer = window.setInterval(async () => {
      const running = localStorage.getItem("aquanex_sim_running") === "true";
      if (!running || sendingRef.current) return;
      const gatewayId = String(workspace?.gateway_id || "").trim();
      const devices = Array.isArray(workspace?.devices) ? workspace.devices : [];
      if (!gatewayId || devices.length === 0) return;

      const now = Date.now();
      const intervalSec = Math.max(5, Math.min(10, Number(localStorage.getItem("aquanex_sim_interval_sec") || 8)));
      const lastPushTs = Number(localStorage.getItem("aquanex_sim_last_push_at") || 0);
      if (now - lastPushTs < intervalSec * 1000) return;

      let startedAt = Number(localStorage.getItem("aquanex_sim_started_at") || 0);
      if (!Number.isFinite(startedAt) || startedAt <= 0) {
        startedAt = now;
        localStorage.setItem("aquanex_sim_started_at", String(startedAt));
      }
      const elapsedMs = now - startedAt;
      let phase: "Normal" | "Leak" | "Breakage" = "Normal";
      if (elapsedMs >= 20000 && elapsedMs < 35000) phase = "Leak";
      else if (elapsedMs >= 35000 && elapsedMs < 50000) phase = "Breakage";

      const ts = new Date().toISOString();
      const telemetry = devices.map((device: any) => {
        const metric = inferMetric(device);
        const group = metricGroup(metric, device?.type || "");
        const sensorIndex = inferSensorIndex(device);
        const prev = latestValuesRef.current[device.id];
        let reading = prev ?? randomAround(50, 2);

        if ((group === "flow" || group === "pressure") && sensorIndex) {
          if (phase === "Leak") {
            reading =
              group === "flow"
                ? sensorIndex === 1
                  ? randomAround(65, 2)
                  : randomAround(45, 2)
                : sensorIndex === 1
                ? randomAround(4.0, 0.1)
                : randomAround(3.0, 0.1);
          } else if (phase === "Breakage") {
            reading =
              group === "flow"
                ? sensorIndex === 1
                  ? randomAround(85, 3)
                  : randomAround(15, 3)
                : sensorIndex === 1
                ? randomAround(4.5, 0.2)
                : randomAround(0.5, 0.1);
          } else {
            reading = group === "flow" ? randomAround(50, 2) : randomAround(4.0, 0.1);
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

      sendingRef.current = true;
      try {
        await api.post("/gateway-telemetry/", {
          gateway_id: gatewayId,
          telemetry,
          prefer_sync_ml: true,
        });
        localStorage.setItem("aquanex_sim_last_push_at", String(Date.now()));
      } finally {
        sendingRef.current = false;
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [workspace]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {showWorkspaceShell && <AppSidebar />}
        <div className="flex flex-col flex-1 min-w-0">
          {showWorkspaceShell && <GlobalHeader />}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
