import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type WorkspaceDevice = {
  id: string;
  type?: string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any;
};

const canonicalDeviceType = (value: string) => {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const aliases: Record<string, string> = {
    pressure_sensor: "pressure_sensor",
    pressure: "pressure_sensor",
    flowmeter: "flowmeter",
    flow_meter: "flowmeter",
    flow_sensor: "flowmeter",
    flow: "flowmeter",
    soil_salinity_sensor: "soil_salinity_sensor",
    soil_salinity: "soil_salinity_sensor",
    salinity_sensor: "soil_salinity_sensor",
    ec_sensor: "soil_salinity_sensor",
    ec: "soil_salinity_sensor",
    conductivity_sensor: "soil_salinity_sensor",
    conductivity: "soil_salinity_sensor",
    electrical_conductivity: "soil_salinity_sensor",
    tds_sensor: "soil_salinity_sensor",
    soil_moisture_sensor: "soil_moisture_sensor",
    soil_moisture: "soil_moisture_sensor",
    moisture_sensor: "soil_moisture_sensor",
    ph_sensor: "ph_sensor",
    ph: "ph_sensor",
    turbidity_sensor: "turbidity_sensor",
    turbidity: "turbidity_sensor",
  };
  return aliases[key] || key;
};

const matchesRequiredType = (device: WorkspaceDevice, requiredTypes: string[]) => {
  const canonical = canonicalDeviceType(String(device?.type || ""));
  if (requiredTypes.includes(canonical)) return true;
  const haystack = [
    String(device?.id || ""),
    String(device?.type || ""),
    String(device?.metric || ""),
  ]
    .join(" ")
    .toLowerCase();
  const matchesSalinity = /salinity|conductivity|\bec\b|ec_ds_m|ec_ms_cm|tds/.test(haystack);
  const matchesMoisture = /moisture|soil_moisture|\bms\b|aqn-ms/.test(haystack);
  const matchesPh = /(^|[^a-z0-9])ph([^a-z0-9]|$)|aqn-ph|potential_hydrogen/.test(haystack);
  const matchesTurbidity = /turbidity|ntu|aqn-tb/.test(haystack);
  const matchesFlow = /flow|lpm|aqn-fm/.test(haystack);
  const matchesPressure = /pressure|bar|psi|aqn-pr|aqn-ps/.test(haystack);

  if (requiredTypes.includes("soil_salinity_sensor") && matchesSalinity) return true;
  if (requiredTypes.includes("soil_moisture_sensor") && matchesMoisture) return true;
  if (requiredTypes.includes("ph_sensor") && matchesPh) return true;
  if (requiredTypes.includes("turbidity_sensor") && matchesTurbidity) return true;
  if (requiredTypes.includes("flowmeter") && matchesFlow) return true;
  if (requiredTypes.includes("pressure_sensor") && matchesPressure) return true;
  return false;
};

const inferredRequiredType = (device: WorkspaceDevice, requiredTypes: string[]): string | null => {
  const canonical = canonicalDeviceType(String(device?.type || ""));
  if (requiredTypes.includes(canonical)) return canonical;
  const haystack = [
    String(device?.id || ""),
    String(device?.type || ""),
    String(device?.metric || ""),
  ]
    .join(" ")
    .toLowerCase();
  if (requiredTypes.includes("soil_moisture_sensor") && /moisture|soil_moisture|\bms\b|aqn-ms/.test(haystack)) {
    return "soil_moisture_sensor";
  }
  if (requiredTypes.includes("soil_salinity_sensor") && /salinity|conductivity|\bec\b|ec_ds_m|ec_ms_cm|tds/.test(haystack)) {
    return "soil_salinity_sensor";
  }
  if (requiredTypes.includes("ph_sensor") && /(^|[^a-z0-9])ph([^a-z0-9]|$)|aqn-ph|potential_hydrogen/.test(haystack)) {
    return "ph_sensor";
  }
  if (requiredTypes.includes("turbidity_sensor") && /turbidity|ntu|aqn-tb/.test(haystack)) {
    return "turbidity_sensor";
  }
  if (requiredTypes.includes("flowmeter") && /flow|lpm|aqn-fm/.test(haystack)) {
    return "flowmeter";
  }
  if (requiredTypes.includes("pressure_sensor") && /pressure|bar|psi|aqn-pr|aqn-ps/.test(haystack)) {
    return "pressure_sensor";
  }
  return null;
};

const hasCoordinates = (device: WorkspaceDevice) =>
  typeof device?.lat === "number" &&
  Number.isFinite(device.lat) &&
  typeof device?.lng === "number" &&
  Number.isFinite(device.lng);

export const useModuleDeviceSetup = (requiredDeviceTypes: string[]) => {
  const { workspace, fetchWorkspace } = useAuth();
  const [gatewayIdInput, setGatewayIdInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [fallbackConfigured, setFallbackConfigured] = useState(false);

  useEffect(() => {
    const value = String(workspace?.gateway_id || "").trim();
    if (value) {
      setGatewayIdInput(value);
    }
  }, [workspace?.gateway_id]);

  const requiredTypes = useMemo(
    () => Array.from(new Set(requiredDeviceTypes.map(canonicalDeviceType).filter(Boolean))),
    [requiredDeviceTypes]
  );

  const allDevices = useMemo<WorkspaceDevice[]>(
    () => (Array.isArray(workspace?.devices) ? (workspace?.devices as WorkspaceDevice[]) : []),
    [workspace?.devices]
  );

  const moduleDevices = useMemo(
    () =>
      allDevices.filter((device) => matchesRequiredType(device, requiredTypes)),
    [allDevices, requiredTypes]
  );

  const geolocatedModuleDevices = useMemo(
    () => moduleDevices.filter(hasCoordinates),
    [moduleDevices]
  );

  const configuredTypes = useMemo(
    () =>
      new Set(
        moduleDevices.map((device) =>
          canonicalDeviceType(String(device?.type || ""))
        )
      ),
    [moduleDevices]
  );

  const missingTypes = useMemo(
    () => requiredTypes.filter((type) => !configuredTypes.has(type)),
    [configuredTypes, requiredTypes]
  );

  const isConfigured = missingTypes.length === 0 || fallbackConfigured;

  useEffect(() => {
    // If real devices are configured later, clear fallback mode.
    if (missingTypes.length === 0 && fallbackConfigured) {
      setFallbackConfigured(false);
    }
  }, [fallbackConfigured, missingTypes.length]);

  const stripModuleDevices = useCallback(async () => {
    const gatewayId = gatewayIdInput.trim() || String(workspace?.gateway_id || "").trim();
    if (!gatewayId) {
      setError("Enter a gateway ID to rescan devices.");
      return false;
    }
    setScanStatus("Preparing rescan: clearing existing module devices...");
    setFallbackConfigured(false);
    const filteredDevices = allDevices.filter(
      (device) => !requiredTypes.includes(canonicalDeviceType(String(device?.type || "")))
    );
    await api.post("/gateway-register/", {
      gateway_id: gatewayId,
      protocol: "mqtt",
      devices: filteredDevices,
    });
    await fetchWorkspace();
    return true;
  }, [allDevices, fetchWorkspace, gatewayIdInput, requiredTypes, workspace?.gateway_id]);

  const scanAndConfigure = useCallback(async (options?: { rescan?: boolean }) => {
    const isRescan = Boolean(options?.rescan);
    const gatewayId = gatewayIdInput.trim();
    if (!gatewayId) {
      setError("Enter a gateway ID to configure devices.");
      return;
    }
    setScanning(true);
    setError("");
    setScanStatus("Starting fast scan...");
    try {
      if (isRescan) {
        const stripped = await stripModuleDevices();
        if (!stripped) return;
      } else if (isConfigured) {
        return;
      }

      const discover = (payload: Record<string, any>, timeoutMs: number) =>
        api.post("/gateway-discover/", payload, { timeout: timeoutMs });
      const runDiscoverWithRetry = async (payload: Record<string, any>, primaryTimeoutMs: number) => {
        try {
          return await discover(payload, primaryTimeoutMs);
        } catch (err: any) {
          const isTimeout = String(err?.message || "").toLowerCase().includes("timeout");
          if (!isTimeout) throw err;
          // Retry once with cache-friendly settings to avoid hard failure on slow TB responses.
          const retryPayload = {
            ...payload,
            force_refresh: false,
          };
          setScanStatus(
            payload?.fast_scan
              ? "Discovery timeout. Retrying with cached fast scan..."
              : "Expanded scan timeout. Retrying with cached expanded scan..."
          );
          return await discover(retryPayload, 20000);
        }
      };

      let discoveryResponse = await runDiscoverWithRetry(
        {
          gateway_id: gatewayId,
          protocol: "mqtt",
          force_refresh: isRescan,
          preview_only: true,
          fast_scan: true,
        },
        isRescan ? 35000 : 15000
      );
      const fastSource = String(discoveryResponse?.data?.source || "fast_scan");
      setScanStatus(`Fast scan complete (${fastSource}). Matching required devices...`);
      let discoveredRaw = Array.isArray(discoveryResponse?.data?.devices)
        ? discoveryResponse.data.devices
        : [];
      const knownById = new Map<string, WorkspaceDevice>();
      allDevices.forEach((device) => knownById.set(String(device.id), device));
      const withKnownCoordinates = (devices: WorkspaceDevice[]) =>
        devices.map((device) => {
          // During rescan, prefer fresh TB coordinates/device metadata only.
          if (isRescan) return device;
          if (hasCoordinates(device)) return device;
          const known = knownById.get(String(device.id));
          if (known && hasCoordinates(known)) {
            return { ...device, lat: known.lat, lng: known.lng };
          }
          return device;
        });
      const discoveredWithCarry = withKnownCoordinates(discoveredRaw);
      let discoveredDevices = discoveredWithCarry.filter(
        (device: WorkspaceDevice) => matchesRequiredType(device, requiredTypes) && hasCoordinates(device)
      );
      if (discoveredDevices.length === 0) {
        // Single fallback: fetch all devices once, then match locally.
        setScanStatus("No immediate match from fast scan. Running expanded scan...");
        discoveryResponse = await runDiscoverWithRetry(
          {
            gateway_id: gatewayId,
            protocol: "mqtt",
            force_refresh: isRescan,
            preview_only: true,
            fast_scan: false,
          },
          isRescan ? 35000 : 20000
        );
        const fallbackSource = String(discoveryResponse?.data?.source || "fallback_scan");
        setScanStatus(`Expanded scan complete (${fallbackSource}). Matching required devices...`);
        discoveredRaw = Array.isArray(discoveryResponse?.data?.devices)
          ? discoveryResponse.data.devices
          : [];
        const allWithCarry = withKnownCoordinates(discoveredRaw);
        discoveredDevices = allWithCarry.filter(
          (device: WorkspaceDevice) => matchesRequiredType(device, requiredTypes) && hasCoordinates(device)
        );
        // If coordinates are not available yet, still allow module setup with matched devices.
        if (discoveredDevices.length === 0) {
          discoveredDevices = allWithCarry.filter((device: WorkspaceDevice) =>
            matchesRequiredType(device, requiredTypes)
          );
        }
      }
      if (discoveredDevices.length === 0) {
        // Global fail-safe mode across modules: never block module page on scan mismatch.
        setFallbackConfigured(true);
        setError("");
        setScanStatus("Scan found no matching sensors. Module is running in fallback mode with demo values.");
        return;
      }
      setFallbackConfigured(false);
      setScanStatus(`Found ${discoveredDevices.length} matching device(s). Registering to workspace...`);
      const normalizedDiscovered = discoveredDevices.map((device) => {
        const inferredType = inferredRequiredType(device, requiredTypes);
        return inferredType ? { ...device, type: inferredType } : device;
      });
      const baseDevices = isRescan
        ? allDevices.filter(
            (device) => !requiredTypes.includes(canonicalDeviceType(String(device?.type || "")))
          )
        : allDevices;
      const byId = new Map<string, WorkspaceDevice>();
      baseDevices.forEach((device) => byId.set(String(device.id), device));
      normalizedDiscovered.forEach((device: WorkspaceDevice) => byId.set(String(device.id), device));
      await api.post("/gateway-register/", {
        gateway_id: gatewayId,
        protocol: "mqtt",
        devices: Array.from(byId.values()),
      });
      setScanStatus("Devices registered. Refreshing workspace data...");
      await fetchWorkspace();
      setScanStatus("Scan complete.");
    } catch (scanError: any) {
      const message =
        scanError?.response?.data?.error ||
        scanError?.message ||
        "Failed to configure devices.";
      // Hard fail-safe across modules: never block page on scan exceptions/timeouts.
      setFallbackConfigured(true);
      setError("");
      setScanStatus("Scan failed to match live sensors. Module is running in fallback mode with demo values.");
    } finally {
      setScanning(false);
    }
  }, [allDevices, fetchWorkspace, gatewayIdInput, isConfigured, requiredTypes, stripModuleDevices]);

  return {
    gatewayIdInput,
    setGatewayIdInput,
    scanning,
    error,
    scanStatus,
    requiredTypes,
    missingTypes,
    moduleDevices,
    geolocatedModuleDevices,
    isConfigured,
    fallbackConfigured,
    scanAndConfigure,
    stripModuleDevices,
  };
};
