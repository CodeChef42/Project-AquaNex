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
      allDevices.filter((device) =>
        requiredTypes.includes(canonicalDeviceType(String(device?.type || "")))
      ),
    [allDevices, requiredTypes]
  );

  const geolocatedModuleDevices = useMemo(
    () => moduleDevices.filter(hasCoordinates),
    [moduleDevices]
  );

  const configuredTypes = useMemo(
    () =>
      new Set(
        geolocatedModuleDevices.map((device) =>
          canonicalDeviceType(String(device?.type || ""))
        )
      ),
    [geolocatedModuleDevices]
  );

  const missingTypes = useMemo(
    () => requiredTypes.filter((type) => !configuredTypes.has(type)),
    [configuredTypes, requiredTypes]
  );

  const isConfigured = missingTypes.length === 0;

  const scanAndConfigure = useCallback(async () => {
    const gatewayId = gatewayIdInput.trim();
    if (!gatewayId) {
      setError("Enter a gateway ID to configure devices.");
      return;
    }
    setScanning(true);
    setError("");
    try {
      let discoveryResponse = await api.post("/gateway-discover/", {
        gateway_id: gatewayId,
        protocol: "mqtt",
        force_refresh: false,
        preview_only: true,
        fast_scan: true,
        required_device_types: requiredTypes,
      });
      let discoveredRaw = Array.isArray(discoveryResponse?.data?.devices)
        ? discoveryResponse.data.devices
        : [];
      let discoveredDevices = discoveredRaw.filter(
        (device: WorkspaceDevice) =>
          requiredTypes.includes(canonicalDeviceType(String(device?.type || ""))) &&
          hasCoordinates(device)
      );
      if (discoveredDevices.length === 0) {
        // Fallback to full live scan only when fast scan cannot satisfy module requirements.
        discoveryResponse = await api.post("/gateway-discover/", {
          gateway_id: gatewayId,
          protocol: "mqtt",
          force_refresh: true,
          preview_only: true,
          fast_scan: false,
          required_device_types: requiredTypes,
        });
        discoveredRaw = Array.isArray(discoveryResponse?.data?.devices)
          ? discoveryResponse.data.devices
          : [];
        discoveredDevices = discoveredRaw.filter(
          (device: WorkspaceDevice) =>
            requiredTypes.includes(canonicalDeviceType(String(device?.type || ""))) &&
            hasCoordinates(device)
        );
      }
      if (discoveredDevices.length === 0) {
        setError("No required geolocated devices found for this module.");
        return;
      }
      const byId = new Map<string, WorkspaceDevice>();
      allDevices.forEach((device) => byId.set(String(device.id), device));
      discoveredDevices.forEach((device) => byId.set(String(device.id), device));
      await api.post("/gateway-register/", {
        gateway_id: gatewayId,
        protocol: "mqtt",
        devices: Array.from(byId.values()),
      });
      await fetchWorkspace();
    } catch (scanError: any) {
      const message =
        scanError?.response?.data?.error ||
        scanError?.message ||
        "Failed to configure devices.";
      setError(String(message));
    } finally {
      setScanning(false);
    }
  }, [allDevices, fetchWorkspace, gatewayIdInput, requiredTypes]);

  return {
    gatewayIdInput,
    setGatewayIdInput,
    scanning,
    error,
    requiredTypes,
    missingTypes,
    moduleDevices,
    geolocatedModuleDevices,
    isConfigured,
    scanAndConfigure,
  };
};
