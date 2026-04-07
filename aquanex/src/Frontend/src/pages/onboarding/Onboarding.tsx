import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Users,
  LayoutGrid,
  MapPin,
  Cpu,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/api";

import { MapContainer, TileLayer, FeatureGroup, Polygon, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { LeafDecor } from '../../components/LeafDecor';


delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LayoutData {
  polygon: number[][]; // [[lng, lat], ...]
  area_m2: number;
  notes: string;
  layoutFile: File | null;
}

interface GatewayDevice {
  id: string;
  microcontroller_id: string;
  type: string;
  sensor_index?: number | string | null;
  zone_id?: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  metric: string;
  reading: number | string;
  last_seen: string;
}

interface GatewayMicrocontroller {
  id: string;
  device_ids: string[];
}

interface OnboardingData {
  workspaceName: string;
  companyName: string;
  companyType: string;
  country: string;
  city: string;
  location: string;
  teamSize: string;
  inviteEmails: string[];
  modules: string[];
  layout: LayoutData;
  devices: GatewayDevice[];
  gatewayId: string;
  gatewayProtocol: string;
  demandForecasting: {
    plants: { name: string; quantity: number | "" }[];
    waterSystems: { name: string; quantity: number | "" }[];
  };
}

type LayoutTaskState = "idle" | "processing" | "ready" | "failed";
type CrsMode = "auto" | "utm39n" | "utm40n" | "uae_grid";
interface ExtractedPoint {
  id: string;
  lng: number;
  lat: number;
  enabled: boolean;
}

interface ModuleRecommendationResult {
  source: string;
  centroid: { lat: number; lng: number } | null;
  area_m2: number;
  place_name: string;
  recommended_modules: string[];
  module_reasons: Record<string, string>;
  summary: string;
}

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const FitMapToPoints = ({
  points,
  fallbackZoom = 12,
  maxZoom = 16,
}: {
  points: [number, number][];
  fallbackZoom?: number;
  maxZoom?: number;
}) => {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [36, 36], maxZoom });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], Math.min(maxZoom, 15));
      return;
    }
    map.setView(DUBAI_CENTER, fallbackZoom);
  }, [fallbackZoom, map, maxZoom, points]);

  return null;
};

const inferLineOrder = (device: GatewayDevice): number | null => {
  const id = String(device.id || "").toLowerCase();
  const type = String(device.type || "").toLowerCase();
  const sensorIndexRaw = String(device.sensor_index ?? "").trim().toLowerCase();
  const descriptor = `${id} ${type} ${sensorIndexRaw}`;

  const isFlow = type.includes("flow");
  const isPressure = type.includes("pressure");
  const index =
    /(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(descriptor)
      ? 1
      : /(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(descriptor)
      ? 2
      : null;

  if (isFlow && index === 1) return 1;
  if (isPressure && index === 1) return 2;
  if (isPressure && index === 2) return 3;
  if (isFlow && index === 2) return 4;
  return null;
};

const isPressureDevice = (device: GatewayDevice): boolean =>
  String(device.type || "").toLowerCase().includes("pressure");

const buildDiamond = (lat: number, lng: number, size = 0.00008): [number, number][] => {
  const lngScale = Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const lngOffset = size / lngScale;
  return [
    [lat + size, lng],
    [lat, lng + lngOffset],
    [lat - size, lng],
    [lat, lng - lngOffset],
  ];
};

const STEPS = [
  { id: 1, label: "Organization", icon: Building2 },
  { id: 2, label: "Team", icon: Users },
  { id: 3, label: "Layout", icon: MapPin },
  { id: 4, label: "Modules", icon: LayoutGrid },
  { id: 5, label: "Gateway", icon: Cpu },
  { id: 7, label: "Ready", icon: CheckCircle },
];

const MODULES = [
  {
    id: "pipeline_management",
    label: "Pipeline Management",
    desc: "Monitor pipelines, pressure and flow",
  },
  {
    id: "soil_salinity",
    label: "Soil Salinity",
    desc: "Track soil salt levels across zones",
  },
  {
    id: "water_quality",
    label: "Water Quality",
    desc: "Monitor pH, TDS, turbidity, chlorine",
  },
  {
    id: "demand_forecasting",
    label: "Demand Forecasting",
    desc: "AI-powered water usage predictions",
  },
  {
    id: "incident_analytics",
    label: "Incident Analytics",
    desc: "Real-time alerts and incident tracking",
  },
];

const MODULE_LABELS = MODULES.reduce<Record<string, string>>((acc, mod) => {
  acc[mod.id] = mod.label;
  return acc;
}, {});

const SPACE_TYPES = [
  "Urban Landscape",
  "Public Park",
  "Sports Facility",
  "Roadside Greenery",
  "Residential Complex",
  "Agricultural",
];

const TEAM_SIZES = ["1-5", "6-20", "21-50", "51-100", "100+"];

const COUNTRY_CITY_OPTIONS: Record<string, string[]> = {
  UAE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"],
  SaudiArabia: ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina"],
  Oman: ["Muscat", "Salalah", "Sohar", "Nizwa"],
  Qatar: ["Doha", "Al Rayyan", "Al Wakrah"],
  Bahrain: ["Manama", "Muharraq", "Riffa"],
  Kuwait: ["Kuwait City", "Al Ahmadi", "Hawalli"],
};

const INITIAL: OnboardingData = {
  workspaceName: "",
  companyName: "",
  companyType: "",
  country: "",
  city: "",
  location: "",
  teamSize: "",
  inviteEmails: [],
  modules: [],
  layout: { polygon: [], area_m2: 0, notes: "", layoutFile: null },
  devices: [],
  gatewayId: "",
  gatewayProtocol: "mqtt",
  demandForecasting: {
    plants: [{ name: "", quantity: "" }],
    waterSystems: [{ name: "", quantity: "" }],
  },
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchWorkspace, workspace, workspaces } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL);
  const [emailInput, setEmailInput] = useState("");
  const [addingEmail, setAddingEmail] = useState(false);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingLayout, setUploadingLayout] = useState(false);
  const [layoutTaskId, setLayoutTaskId] = useState<string | null>(null);
  const [layoutTaskState, setLayoutTaskState] = useState<LayoutTaskState>("idle");
  const [layoutTaskMessage, setLayoutTaskMessage] = useState("");
  const [manualPolygon, setManualPolygon] = useState<number[][]>([]);
  const [extractedPolygon, setExtractedPolygon] = useState<number[][]>([]);
  const [extractedPoints, setExtractedPoints] = useState<ExtractedPoint[]>([]);
  const [crsMode, setCrsMode] = useState<CrsMode>("auto");
  const [manualCoordsInput, setManualCoordsInput] = useState("");
  const [manualCoordsError, setManualCoordsError] = useState("");
  const [layoutConfirmed, setLayoutConfirmed] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [discoveringGateway, setDiscoveringGateway] = useState(false);
  const [confirmingDevices, setConfirmingDevices] = useState(false);
  const [devicesConfirmed, setDevicesConfirmed] = useState(false);
  const [gatewayError, setGatewayError] = useState("");
  const [gatewaySource, setGatewaySource] = useState("");
  const [onboardingWorkspaceId, setOnboardingWorkspaceId] = useState<string | null>(null);
  const createNewWorkspace = searchParams.get("new") === "1";
  const hasExistingWorkspaces = workspaces.length > 0;
  const skipCompanyIdentity = createNewWorkspace && hasExistingWorkspaces;
  const visibleSteps = useMemo(
    () =>
      STEPS.filter((stepDef) => {
        if (stepDef.id === 5) return false;
        return true;
      }),
    []
  );
  const visibleStepIds = useMemo(() => visibleSteps.map((stepDef) => stepDef.id), [visibleSteps]);
  const lastVisibleStepId = visibleStepIds[visibleStepIds.length - 1] || 7;
  const [missingCoordinates, setMissingCoordinates] = useState<string[]>([]);
  const [detectedLayoutPlace, setDetectedLayoutPlace] = useState("");
  const [detectedLayoutCoords, setDetectedLayoutCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [weatherError, setWeatherError] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendation, setRecommendation] = useState<ModuleRecommendationResult | null>(null);
  const [recommendationSignature, setRecommendationSignature] = useState("");
  const [recommendationModalOpen, setRecommendationModalOpen] = useState(false);
  const [weeklyForecast, setWeeklyForecast] = useState<{
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    windspeed_10m_max: number[];
  } | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const supportedLayoutExtensions = ["pdf", "jpg", "jpeg", "png", "dwg", "kml"];

  const goToNextVisibleStep = useCallback((currentStep: number) => {
    const idx = visibleStepIds.indexOf(currentStep);
    if (idx === -1) return visibleStepIds[0] || 1;
    return visibleStepIds[Math.min(visibleStepIds.length - 1, idx + 1)];
  }, [visibleStepIds]);

  const goToPreviousVisibleStep = useCallback((currentStep: number) => {
    const idx = visibleStepIds.indexOf(currentStep);
    if (idx <= 0) return visibleStepIds[0] || 1;
    return visibleStepIds[idx - 1];
  }, [visibleStepIds]);
  const convexHull = (points: number[][]): number[][] => {
    const uniq = Array.from(
      new Set(points.map(([lng, lat]) => `${lng.toFixed(7)},${lat.toFixed(7)}`))
    ).map((s) => s.split(",").map(Number) as number[][][number]);
    if (uniq.length < 3) return uniq;
    uniq.sort(([ax, ay], [bx, by]) => (ax === bx ? ay - by : ax - bx));
    const cross = (o: number[], a: number[], b: number[]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

    const lower: number[][] = [];
    uniq.forEach((p) => {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
      ) {
        lower.pop();
      }
      lower.push(p);
    });

    const upper: number[][] = [];
    [...uniq].reverse().forEach((p) => {
      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
      ) {
        upper.pop();
      }
      upper.push(p);
    });

    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  };
  const polygonFromEnabledPoints = (): number[][] => {
    const enabled = extractedPoints
      .filter((p) => p.enabled)
      .map((p) => [p.lng, p.lat] as number[]);
    if (enabled.length < 3) return [];
    return convexHull(enabled);
  };

  useEffect(() => {
    if (!skipCompanyIdentity) return;
    const primaryWorkspace = workspaces[0];
    const inheritedCompanyName = String(primaryWorkspace?.company_name || "").trim();
    if (!inheritedCompanyName) return;
    setData((prev) => ({
      ...prev,
      companyName: prev.companyName || inheritedCompanyName,
    }));
  }, [skipCompanyIdentity, workspaces]);

  const centroidFromPolygon = (polygon: number[][]): { lat: number; lng: number } | null => {
    const points = Array.isArray(polygon) ? polygon : [];
    if (points.length < 3) return null;
    const sums = points.reduce(
      (acc, [lng, lat]) => {
        const lngNum = Number(lng);
        const latNum = Number(lat);
        if (!Number.isFinite(lngNum) || !Number.isFinite(latNum)) return acc;
        acc.lng += lngNum;
        acc.lat += latNum;
        acc.count += 1;
        return acc;
      },
      { lat: 0, lng: 0, count: 0 }
    );
    if (sums.count < 3) return null;
    return { lat: sums.lat / sums.count, lng: sums.lng / sums.count };
  };

  useEffect(() => {
    if (!layoutConfirmed) {
      setDetectedLayoutCoords(null);
      setDetectedLayoutPlace("");
      setWeatherStatus("idle");
      setWeatherError("");
      setWeeklyForecast(null);
      return;
    }

    const polygon = data.layout.polygon;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      setDetectedLayoutCoords(null);
      setDetectedLayoutPlace("");
      setWeatherStatus("idle");
      setWeatherError("");
      setWeeklyForecast(null);
      return;
    }

    const centroid = centroidFromPolygon(polygon);
    if (!centroid) return;

    const controller = new AbortController();
    setDetectedLayoutCoords(centroid);
    setWeatherStatus("loading");
    setWeatherError("");

    const lat = centroid.lat;
    const lng = centroid.lng;

    (async () => {
      try {
        const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          String(lat)
        )}&lon=${encodeURIComponent(String(lng))}`;
        const reverseResp = await fetch(reverseUrl, { signal: controller.signal });
        const reverseJson: any = await reverseResp.json();

        const address = reverseJson?.address || {};
        const locality =
          address.city ||
          address.town ||
          address.village ||
          address.hamlet ||
          address.suburb ||
          address.state ||
          "";
        const country = address.country || "";
        const label = [locality, country].filter(Boolean).join(", ");
        const fallbackLabel = String(reverseJson?.display_name || "")
          .split(",")
          .slice(0, 2)
          .join(",")
          .trim();
        setDetectedLayoutPlace(label || fallbackLabel);

        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
          String(lat)
        )}&longitude=${encodeURIComponent(
          String(lng)
        )}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=7`;
        const forecastResp = await fetch(forecastUrl, { signal: controller.signal });
        const forecastJson: any = await forecastResp.json();

        const daily = forecastJson?.daily || {};
        const time = Array.isArray(daily?.time) ? daily.time : [];
        const temperature_2m_max = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
        const temperature_2m_min = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];
        const precipitation_sum = Array.isArray(daily?.precipitation_sum) ? daily.precipitation_sum : [];
        const windspeed_10m_max = Array.isArray(daily?.windspeed_10m_max) ? daily.windspeed_10m_max : [];

        if (!time.length) {
          throw new Error("Weather forecast unavailable for this location.");
        }

        setWeeklyForecast({
          time,
          temperature_2m_max,
          temperature_2m_min,
          precipitation_sum,
          windspeed_10m_max,
        });
        setWeatherStatus("ready");
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setWeatherStatus("error");
        setWeeklyForecast(null);
        setWeatherError(e?.message || "Failed to load weather forecast.");
      }
    })();

    return () => controller.abort();
  }, [data.layout.polygon, layoutConfirmed]);
  const parseManualCoords = (raw: string): number[][] => {
    const matches = raw.match(/-?\d+(?:\.\d+)?/g) || [];
    if (matches.length < 6 || matches.length % 2 !== 0) return [];
    const points: number[][] = [];
    for (let i = 0; i < matches.length; i += 2) {
      const first = Number(matches[i]);
      const second = Number(matches[i + 1]);
      if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
      // Prefer lng,lat input. If user pasted lat,lng, swap when needed.
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
        points.push([second, first]);
      } else {
        points.push([first, second]);
      }
    }
    return points.filter(([lng, lat]) => Math.abs(lng) <= 180 && Math.abs(lat) <= 90);
  };
  const applyManualCoordinates = () => {
    const parsed = parseManualCoords(manualCoordsInput);
    if (parsed.length < 3) {
      setManualCoordsError("Enter at least 3 coordinate points (lng,lat or lat,lng).");
      return;
    }
    const enclosure = convexHull(parsed);
    if (enclosure.length < 3) {
      setManualCoordsError("Unable to form enclosure from entered coordinates.");
      return;
    }
    const area = calculateArea(enclosure);
    setManualCoordsError("");
    setExtractedPolygon([]);
    setExtractedPoints([]);
    setLayoutTaskId(null);
    setLayoutTaskState("idle");
    setLayoutTaskMessage("");
    setManualPolygon(enclosure);
    setLayoutConfirmed(false);
    setData((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        polygon: enclosure,
        area_m2: area,
      },
    }));
  };
  const extractedPolygonFromPoints = polygonFromEnabledPoints();
  const discoveredMicrocontrollers = useMemo<GatewayMicrocontroller[]>(() => {
    const byMcu = new Map<string, string[]>();
    data.devices.forEach((device) => {
      const mcuId = device.microcontroller_id || "UNASSIGNED-MCU";
      const existing = byMcu.get(mcuId) || [];
      existing.push(device.id);
      byMcu.set(mcuId, existing);
    });

    return Array.from(byMcu.entries())
      .map(([id, device_ids]) => ({ id, device_ids: [...new Set(device_ids)].sort() }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data.devices]);
  const geolocatedDevices = useMemo(
    () =>
      data.devices.filter(
        (device) =>
          typeof device.lat === "number" &&
          Number.isFinite(device.lat) &&
          typeof device.lng === "number" &&
          Number.isFinite(device.lng)
      ),
    [data.devices]
  );
  const pipelineLinePositions = useMemo(() => {
    const byOrder = new Map<number, [number, number]>();
    geolocatedDevices
      .map((device) => ({ device, order: inferLineOrder(device) }))
      .filter((item): item is { device: GatewayDevice; order: number } => item.order !== null)
      .sort((a, b) => a.order - b.order)
      .forEach((item) => {
        if (!byOrder.has(item.order)) {
          byOrder.set(item.order, [item.device.lat as number, item.device.lng as number]);
        }
      });

    const ordered = [1, 2, 3, 4]
      .map((order) => byOrder.get(order))
      .filter((pos): pos is [number, number] => Boolean(pos));

    return ordered.length >= 2 ? ordered : [];
  }, [geolocatedDevices]);
  const gatewayMapFocusPoints = useMemo<[number, number][]>(() => {
    const layoutPoints = data.layout.polygon
      .map(([lng, lat]) => [lat, lng] as [number, number])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const devicePoints = geolocatedDevices
      .map((device) => [device.lat as number, device.lng as number] as [number, number]);
    return [...layoutPoints, ...devicePoints];
  }, [data.layout.polygon, geolocatedDevices]);
  const finalLayoutPolygon =
    extractedPolygonFromPoints.length > 2
      ? extractedPolygonFromPoints
      : extractedPolygon.length > 2
      ? extractedPolygon
      : manualPolygon.length > 2
      ? manualPolygon
      : data.layout.polygon;
  const finalLayoutSource =
    extractedPolygonFromPoints.length > 2 || extractedPolygon.length > 2
      ? "document_refined"
      : manualPolygon.length > 2
      ? "manual_draw"
      : "none";
  const finalLayoutLatLng = useMemo<[number, number][]>(
    () =>
      finalLayoutPolygon
        .map(([lng, lat]) => [lat, lng] as [number, number])
        .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])),
    [finalLayoutPolygon]
  );

  const update = (fields: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...fields }));

  const toggleModule = (id: string) =>
    update({
      modules: data.modules.includes(id)
        ? data.modules.filter((m) => m !== id)
        : [...data.modules, id],
    });

  const updatePlantRow = (index: number, fields: Partial<{ name: string; quantity: number | "" }>) => {
    const nextRows = data.demandForecasting.plants.map((row, i) =>
      i === index ? { ...row, ...fields } : row
    );
    update({
      demandForecasting: {
        ...data.demandForecasting,
        plants: nextRows,
      },
    });
  };

  const updateWaterSystemRow = (index: number, fields: Partial<{ name: string; quantity: number | "" }>) => {
    const nextRows = data.demandForecasting.waterSystems.map((row, i) =>
      i === index ? { ...row, ...fields } : row
    );
    update({
      demandForecasting: {
        ...data.demandForecasting,
        waterSystems: nextRows,
      },
    });
  };

  const addPlantRow = () => {
    update({
      demandForecasting: {
        ...data.demandForecasting,
        plants: [...data.demandForecasting.plants, { name: "", quantity: "" }],
      },
    });
  };

  const addWaterSystemRow = () => {
    update({
      demandForecasting: {
        ...data.demandForecasting,
        waterSystems: [...data.demandForecasting.waterSystems, { name: "", quantity: "" }],
      },
    });
  };

  const removePlantRow = (index: number) => {
    const remaining = data.demandForecasting.plants.filter((_, i) => i !== index);
    update({
      demandForecasting: {
        ...data.demandForecasting,
        plants: remaining.length ? remaining : [{ name: "", quantity: "" }],
      },
    });
  };

  const removeWaterSystemRow = (index: number) => {
    const remaining = data.demandForecasting.waterSystems.filter((_, i) => i !== index);
    update({
      demandForecasting: {
        ...data.demandForecasting,
        waterSystems: remaining.length ? remaining : [{ name: "", quantity: "" }],
      },
    });
  };

  const addEmail = async () => {
    if (!emailInput) return;
    if (data.inviteEmails.includes(emailInput)) {
      toast({
        title: "Already added",
        description: "This email is already in the list.",
        variant: "destructive",
      });
      return;
    }

    setAddingEmail(true);
    try {
      const targetWorkspaceId = await ensureTargetWorkspaceId();
      if (!targetWorkspaceId) {
        throw new Error("Could not ensure workspace ID.");
      }

      await api.post(
        "/workspace-invite/",
        { email: emailInput },
        { headers: { "X-Workspace-Id": targetWorkspaceId } }
      );

      toast({
        title: "Invitation sent",
        description: `Invitation email sent to ${emailInput}`,
      });

      update({ inviteEmails: [...data.inviteEmails, emailInput] });
      setEmailInput("");
    } catch (error) {
      console.error("Failed to send invite:", error);
      toast({
        title: "Invitation failed",
        description: "Could not send invitation email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingEmail(false);
    }
  };

  const buildDemandForecastingPayload = () => {
    const plants = data.demandForecasting.plants
      .filter((item) => item.name.trim() !== "" && Number(item.quantity) > 0)
      .map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity) }));
    const waterSystems = data.demandForecasting.waterSystems
      .filter((item) => item.name.trim() !== "" && Number(item.quantity) > 0)
      .map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity) }));
    return { plants, waterSystems };
  };

  const requestModuleRecommendation = async (polygonOverride?: number[][]) => {
    const polygon = Array.isArray(polygonOverride) && polygonOverride.length >= 3
      ? polygonOverride
      : finalLayoutPolygon;
    if (!Array.isArray(polygon) || polygon.length < 3) return;
    const signature = JSON.stringify(polygon);
    if (recommendationLoading) return;
    if (recommendationSignature === signature && recommendation) return;
    setRecommendationLoading(true);
    setRecommendationError("");
    try {
      const targetWorkspaceId = await ensureTargetWorkspaceId();
      const response = await api.post("/layout-module-recommendation/", {
        workspaceId: targetWorkspaceId || undefined,
        layout_polygon: polygon,
      });
      const payload = response?.data || {};
      const recommended = Array.isArray(payload?.recommended_modules)
        ? payload.recommended_modules.map((item: any) => String(item))
        : [];
      const moduleReasons =
        payload?.module_reasons && typeof payload.module_reasons === "object"
          ? payload.module_reasons
          : {};
      setRecommendation({
        source: String(payload?.source || "heuristic"),
        centroid:
          payload?.centroid && typeof payload.centroid === "object"
            ? {
                lat: Number(payload.centroid.lat || 0),
                lng: Number(payload.centroid.lng || 0),
              }
            : null,
        area_m2: Number(payload?.area_m2 || 0),
        place_name: String(payload?.place_name || ""),
        recommended_modules: recommended,
        module_reasons: moduleReasons,
        summary: String(payload?.summary || ""),
      });
      setRecommendationSignature(signature);
    } catch (error: any) {
      setRecommendationError(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to generate module recommendation."
      );
    } finally {
      setRecommendationLoading(false);
    }
  };

  const applyRecommendedModules = () => {
    if (!recommendation || !Array.isArray(recommendation.recommended_modules)) return;
    const next = recommendation.recommended_modules.filter((moduleId) =>
      MODULES.some((moduleDef) => moduleDef.id === moduleId)
    );
    if (!next.length) return;
    update({ modules: next });
    toast({
      title: "Modules applied",
      description: "Recommended modules have been selected.",
    });
  };

  const canProceed = () => {
    if (step === 1)
      return (
        data.workspaceName.trim() !== "" &&
        (skipCompanyIdentity || data.companyName.trim() !== "") &&
        data.companyType !== "" &&
        (skipCompanyIdentity || (data.country !== "" && data.city !== "" && data.location.trim() !== ""))
      );

    if (step === 3) {
      if (finalLayoutPolygon.length < 3) return false;
      finalLayoutPolygon.length >= 3
    }

    if (step === 4) return data.modules.length > 0;
    return true;
  };

  const ensureTargetWorkspaceId = useCallback(async () => {
    if (onboardingWorkspaceId) return onboardingWorkspaceId;
    if (!createNewWorkspace) return workspace?.id || null;

    // ── CHANGED: wrapped in try/catch to expose real error ──
    const bootstrap = await api.post("/onboarding/", {
      createNewWorkspace: true,
      workspaceName: data.workspaceName || "New Workspace",
      companyName: data.companyName,
      companyType: data.companyType,
      location: [data.location.trim(), data.city, data.country].filter(Boolean).join(", "),
      teamSize: data.teamSize,
      modules: data.modules,
      inviteEmails: data.inviteEmails,
      devices: data.devices,
      layout_polygon: data.layout.polygon,
      layout_area_m2: data.layout.area_m2,
      layout_notes: data.layout.notes,
      gatewayId: data.gatewayId,
      gatewayProtocol: data.gatewayProtocol,
      demandForecasting: buildDemandForecastingPayload(),
    }).catch((err: any) => {
      // ── ADDED: log exact backend error ──
      console.error("❌ /onboarding/ failed | Status:", err?.response?.status);
      console.error("❌ Response:", err?.response?.data);
      console.error("❌ Message:", err?.message);
      return null;
    });

    // ── ADDED: guard if request failed ──
    if (!bootstrap) return null;

    const newId = String(bootstrap?.data?.workspace_id || "");

    // ── ADDED: log if response came back but no workspace_id ──
    if (!newId) {
      console.error("❌ No workspace_id in response:", bootstrap?.data);
      return null;
    }

    setOnboardingWorkspaceId(newId);
    return newId;
  }, [onboardingWorkspaceId, createNewWorkspace, workspace?.id, data]);

 const calculateArea = (coords: number[][]): number => {
  if (coords.length < 3) return 0;

  const polygon =
    coords.length >= 2 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords.slice(0, -1)
      : coords;

  if (polygon.length < 3) return 0;

  const R = 6378137;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [lng1, lat1] = polygon[i];
    const [lng2, lat2] = polygon[(i + 1) % polygon.length];
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const lam1 = toRad(lng1);
    const lam2 = toRad(lng2);
    sum += (lam2 - lam1) * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  return Math.abs((sum * R * R) / 2);
};

  const formatArea = (areaM2: number) => {
    const area = Number.isFinite(areaM2) ? Math.max(0, areaM2) : 0;
    if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
    if (area >= 10_000) return `${(area / 10_000).toFixed(2)} ha`;
    return `${Math.round(area).toLocaleString()} m²`;
  };


  const handleFinish = async () => {
    setSaving(true);
    try {
      const targetWorkspaceId = await ensureTargetWorkspaceId();
      const shouldCreateWorkspace = createNewWorkspace && !targetWorkspaceId;
      const res = await api.post("/onboarding/", {
        workspaceId: targetWorkspaceId || undefined,
        createNewWorkspace: shouldCreateWorkspace,
        workspaceName: data.workspaceName,
        companyName: data.companyName,
        companyType: data.companyType,
        location: [data.location.trim(), data.city, data.country].filter(Boolean).join(", "),
        teamSize: data.teamSize,
        modules: data.modules,
        inviteEmails: data.inviteEmails,
        devices: data.devices,
        layout_polygon: data.layout.polygon,
        layout_area_m2: data.layout.area_m2,
        layout_notes: data.layout.notes,
        gatewayId: data.gatewayId,
        gatewayProtocol: data.gatewayProtocol,
        demandForecasting: buildDemandForecastingPayload(),
      });
      if (res.status >= 200 && res.status < 300) {
        await fetchWorkspace();
      }
    } catch (err) {
      console.error("Onboarding save failed:", err);
    } finally {
      setSaving(false);
      navigate("/workspaces");
    }
  };

  const handleLayoutUpload = async () => {
    if (!data.layout.layoutFile) {
      alert("Please select a layout file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", data.layout.layoutFile);
    formData.append("layoutFile", data.layout.layoutFile);
    if (data.layout.notes.trim()) {
      formData.append("notes", data.layout.notes.trim());
    }
    formData.append("crs_hint", crsMode);
    if (data.layout.polygon.length > 0) {
      formData.append("polygon", JSON.stringify(data.layout.polygon));
      formData.append("area_m2", String(data.layout.area_m2));
    }

    setUploadingLayout(true);
    setLayoutTaskState("processing");
    setLayoutConfirmed(false);
    setExtractedPolygon([]);
    setExtractedPoints([]);
    setLayoutTaskMessage("Upload queued. Waiting for extraction result...");
    try {
      const targetWorkspaceId = await ensureTargetWorkspaceId();
      if (targetWorkspaceId) {
        formData.append("workspace_id", targetWorkspaceId);
      }
      const response = await api.post("/layout-upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const payload = response?.data || {};
      if (!(response.status >= 200 && response.status < 300)) {
        const errorMessage =
          payload?.error ||
          payload?.detail ||
          payload?.message ||
          `Upload failed with status ${response.status || "unknown"}`;
        throw new Error(errorMessage);
      }

      const taskId = payload?.task_id;
      if (!taskId) {
        alert("Upload succeeded, but no task_id was returned.");
        return;
      }

      alert(`Upload queued successfully. Task ID: ${taskId}`);
      setLayoutTaskId(taskId);
    } catch (error) {
      console.error("Layout upload failed:", error);
      const axiosError = error as AxiosError<any>;
      const backendPayload = axiosError?.response?.data || {};
      const detailedMessage =
        backendPayload?.details ||
        backendPayload?.error ||
        backendPayload?.detail ||
        (error instanceof Error ? error.message : "");
      setLayoutTaskState("failed");
      setLayoutTaskMessage(
        detailedMessage || "Upload failed. Please try again."
      );
      alert(
        detailedMessage || "Upload failed. Please try again."
      );
    } finally {
      setUploadingLayout(false);
    }
  };

  const clearManualPolygon = () => {
    setManualPolygon([]);
    setLayoutConfirmed(false);
    if (extractedPolygon.length >= 3) {
      const area = calculateArea(extractedPolygon);
      setData((prev) => ({
        ...prev,
        layout: {
          ...prev.layout,
          polygon: extractedPolygon,
          area_m2: area,
        },
      }));
      return;
    }
    setData((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        polygon: [],
        area_m2: 0,
      },
    }));
  };

  const clearExtractedPolygon = () => {
    setExtractedPolygon([]);
    setExtractedPoints([]);
    setLayoutTaskId(null);
    setLayoutTaskState("idle");
    setLayoutTaskMessage("");
    setLayoutConfirmed(false);
    if (manualPolygon.length >= 3) {
      const area = calculateArea(manualPolygon);
      setData((prev) => ({
        ...prev,
        layout: {
          ...prev.layout,
          polygon: manualPolygon,
          area_m2: area,
        },
      }));
      return;
    }
    setData((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        polygon: [],
        area_m2: 0,
      },
    }));
  };

  const clearLayoutSelection = () => {
    if (pollingTimerRef.current) {
      window.clearTimeout(pollingTimerRef.current);
    }
    setManualPolygon([]);
    setExtractedPolygon([]);
    setExtractedPoints([]);
    setLayoutTaskId(null);
    setLayoutTaskState("idle");
    setLayoutTaskMessage("");
    setLayoutConfirmed(false);
    setSavingLayout(false);
    setRecommendation(null);
    setRecommendationSignature("");
    setRecommendationError("");
    setRecommendationModalOpen(false);
    setData((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        polygon: [],
        area_m2: 0,
        layoutFile: null,
      },
    }));
  };

  const handleConfirmLayout = async () => {
    if (finalLayoutPolygon.length < 3) return;

    setSavingLayout(true);
    try {
      const targetWorkspaceId = await ensureTargetWorkspaceId();
      const payload = {
        workspaceId: targetWorkspaceId || undefined,
        layout_polygon: finalLayoutPolygon,
        layout_area_m2: finalLayoutArea,
        layout_notes: data.layout.notes,
        location: detectedLayoutPlace || undefined, // Save detected location
      };
      await api.post("/onboarding/", payload);

      setData((prev) => ({
        ...prev,
        location: detectedLayoutPlace || prev.location, // Update local state
        layout: {
          ...prev.layout,
          polygon: finalLayoutPolygon,
          area_m2: finalLayoutArea,
        },
      }));
      setLayoutConfirmed(true);
      await requestModuleRecommendation(finalLayoutPolygon);
      await fetchWorkspace();
    } catch (error) {
      console.error("Layout confirm save failed:", error);
      setLayoutConfirmed(false);
      alert("Failed to save layout. Please try again.");
    } finally {
      setSavingLayout(false);
    }
  };

  const handleGatewayDiscover = async () => {
    const gatewayId = data.gatewayId.trim();
    if (!gatewayId) {
      setGatewayError("Enter a gateway ID first.");
      return;
    }

    setDiscoveringGateway(true);
    setGatewayError("");
    setDevicesConfirmed(false);
    try {
      const targetWorkspaceId = await ensureTargetWorkspaceId();
      const response = await api.post("/gateway-discover/", {
        workspaceId: targetWorkspaceId || undefined,
        gateway_id: gatewayId,
        protocol: data.gatewayProtocol || "mqtt",
        force_refresh: true,
        preview_only: true,
      });
      const payload = response?.data || {};
      const devices = Array.isArray(payload?.devices) ? payload.devices : [];
      if (devices.length === 0) {
        throw new Error("No devices found in gateway memory.");
      }

      setData((prev) => ({
        ...prev,
        gatewayId,
        devices,
      }));
      setMissingCoordinates(
        Array.isArray(payload?.missing_coordinates) ? payload.missing_coordinates : []
      );
      setGatewaySource(String(payload?.source || "unknown"));
      setGatewayError("");
    } catch (error) {
      const msg =
        (error as any)?.response?.data?.error ||
        (error as Error)?.message ||
        "Gateway discovery failed.";
      setGatewayError(msg);
      setGatewaySource("");
      setMissingCoordinates([]);
    } finally {
      setDiscoveringGateway(false);
    }
  };

  const handleConfirmDevices = async () => {
    if (!data.gatewayId.trim() || data.devices.length === 0) return;
    setConfirmingDevices(true);
    setGatewayError("");
    try {
      const targetWorkspaceId = await ensureTargetWorkspaceId();
      const response = await api.post("/gateway-register/", {
        workspaceId: targetWorkspaceId || undefined,
        gateway_id: data.gatewayId.trim(),
        protocol: data.gatewayProtocol || "mqtt",
        devices: data.devices,
      });
      const payload = response?.data || {};
      const persistedDevices = Array.isArray(payload?.devices) ? payload.devices : data.devices;
      setData((prev) => ({
        ...prev,
        devices: persistedDevices,
      }));
      setDevicesConfirmed(true);
      await fetchWorkspace();
    } catch (error) {
      const msg =
        (error as any)?.response?.data?.error ||
        (error as Error)?.message ||
        "Failed to confirm devices.";
      setGatewayError(msg);
      setDevicesConfirmed(false);
    } finally {
      setConfirmingDevices(false);
    }
  };

  useEffect(() => {
    if (!workspace) return;
    if (createNewWorkspace) return;
    const [locationPart = "", cityPart = "", countryPart = ""] = String(workspace.location || "")
      .split(",")
      .map((v) => v.trim());
    const gatewayId = String(workspace?.gateway_id || "").trim();
    const devices = Array.isArray(workspace?.devices)
      ? (workspace.devices as GatewayDevice[])
      : [];
    setData((prev) => ({
      ...prev,
      workspaceName:
        createNewWorkspace
          ? prev.workspaceName
          : String((workspace as any)?.workspace_name || ""),
      companyName: skipCompanyIdentity ? prev.companyName : String(workspace.company_name || prev.companyName || ""),
      country: skipCompanyIdentity ? prev.country : countryPart || prev.country,
      city: skipCompanyIdentity ? prev.city : cityPart || prev.city,
      location: skipCompanyIdentity ? prev.location : locationPart || prev.location,
      gatewayId: gatewayId || prev.gatewayId,
      devices: devices.length > 0 ? devices : prev.devices,
    }));
    if (gatewayId && devices.length > 0) {
      setDevicesConfirmed(true);
    }
  }, [workspace, createNewWorkspace, skipCompanyIdentity]);

  useEffect(() => {
    if (step === 5) {
      setStep(goToNextVisibleStep(5));
      return;
    }
  }, [step, goToNextVisibleStep]);

  useEffect(() => {
  if (step !== 4) return;
  if (recommendation || recommendationLoading) return;
  void requestModuleRecommendation();
}, [step, finalLayoutPolygon]);

  useEffect(() => {
    if (!layoutTaskId) return;

    let isCancelled = false;
    const pollTask = async () => {
      try {
        const query = onboardingWorkspaceId
          ? `?workspace_id=${encodeURIComponent(onboardingWorkspaceId)}`
          : "";
        const response = await api.get(`/layout-status/${layoutTaskId}/${query}`);
        const payload = response?.data || {};
        if (response.status < 200 || response.status >= 300 || isCancelled) return;

        const ws = payload?.workspace;
        const currentState: LayoutTaskState =
          ws?.layout_status === "ready"
            ? "ready"
            : ws?.layout_status === "failed"
            ? "failed"
            : "processing";
        setLayoutTaskState(currentState);

        if (currentState === "ready") {
          const taskResult = payload?.result || {};
          const rawPoints = Array.isArray(taskResult?.extracted_points)
            ? taskResult.extracted_points
            : [];
          if (rawPoints.length >= 3) {
            const points: ExtractedPoint[] = rawPoints
              .map((point: any, idx: number) => ({
                id: `pt-${idx}`,
                lng: Number(point?.[0]),
                lat: Number(point?.[1]),
                enabled: Number.isFinite(Number(point?.[0])) && Number.isFinite(Number(point?.[1])),
              }))
              .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat));
            setExtractedPoints(points);
          }
          if (Array.isArray(ws?.layout_polygon) && ws.layout_polygon.length >= 3) {
            setExtractedPolygon(ws.layout_polygon);
            setLayoutConfirmed(false);
            setData((prev) => ({
              ...prev,
              layout: {
                ...prev.layout,
                polygon: ws.layout_polygon,
                area_m2: Number(ws.layout_area_m2 || prev.layout.area_m2 || 0),
              },
            }));
          }
          setLayoutTaskMessage(
            manualPolygon.length >= 3
              ? `Document coordinates extracted and used to refine your drawn boundary (${taskResult?.crs_used || "CRS auto"}).`
              : `Drawing extracted from uploaded file (${taskResult?.crs_used || "CRS auto"}).`
          );
          return;
        }

        if (currentState === "failed") {
          setLayoutTaskMessage(
            ws?.layout_job_error ||
              "No georeferenced coordinates found. Using manual polygon."
          );
          return;
        }

        pollingTimerRef.current = window.setTimeout(pollTask, 2500);
      } catch (err) {
        if (!isCancelled) {
          pollingTimerRef.current = window.setTimeout(pollTask, 4000);
        }
      }
    };

    pollTask();

    return () => {
      isCancelled = true;
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
    };
  }, [layoutTaskId, onboardingWorkspaceId, manualPolygon.length]);

  const finalLayoutArea =
    finalLayoutPolygon.length >= 3 ? calculateArea(finalLayoutPolygon) : 0;

  const renderStep = () => {
    const cityOptions = COUNTRY_CITY_OPTIONS[data.country] || [];
    // ─── Step 1 ───
    if (step === 1)
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">
              Tell us about your organization
            </h2>
            <p className="text-muted-foreground mt-1">
              This helps AquaNex configure your workspace correctly.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Irrigation Project Name<span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter your greenspace name"
              value={data.workspaceName}
              onChange={(e) => update({ workspaceName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          {!skipCompanyIdentity && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Organization Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your company name"
                  value={data.companyName}
                  onChange={(e) => update({ companyName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Country <span className="text-destructive">*</span>
                </label>
                <select
                  value={data.country}
                  onChange={(e) =>
                    update({
                      country: e.target.value,
                      city: "",
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                >
                  <option value="">Select country</option>
                  {Object.keys(COUNTRY_CITY_OPTIONS).map((countryKey) => (
                    <option key={countryKey} value={countryKey}>
                      {countryKey.replace(/([A-Z])/g, " $1").trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  City <span className="text-destructive">*</span>
                </label>
                <select
                  value={data.city}
                  onChange={(e) => update({ city: e.target.value })}
                  disabled={!data.country}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {data.country ? "Select city" : "Select country first"}
                  </option>
                  {cityOptions.map((cityName) => (
                    <option key={cityName} value={cityName}>
                      {cityName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Company Location <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dubai Municipality Parks HQ, Al Safa 2"
                  value={data.location}
                  onChange={(e) => update({ location: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Irrigation Project Type <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SPACE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update({ companyType: type })}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    data.companyType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {type}
                </button>
              ))}
              <button
                type="button"
                onClick={() => update({ companyType: "Other" })}
                className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  !SPACE_TYPES.includes(data.companyType) && data.companyType !== ""
                    ? "border-primary bg-primary/10 text-primary"
                    : data.companyType === "Other"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                Other
              </button>
            </div>
            {(data.companyType === "Other" || (!SPACE_TYPES.includes(data.companyType) && data.companyType !== "")) && (
              <input
                type="text"
                placeholder="Describe your irrigation project type..."
                value={SPACE_TYPES.includes(data.companyType) ? "" : data.companyType === "Other" ? "" : data.companyType}
                onChange={(e) => update({ companyType: e.target.value })}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm mt-2"
              />
            )}
          </div>
        </div>
      );

    // ─── Step 2 ───
    if (step === 2)
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Set up your team</h2>
            <p className="text-muted-foreground mt-1">
              Invite colleagues to collaborate. You can do this later too.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Team Size</label>
            <div className="flex flex-wrap gap-3">
              {TEAM_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => update({ teamSize: size })}
                  className={`px-5 py-2 rounded-xl border text-sm font-medium transition-all ${
                    data.teamSize === size
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Invite Team Members</label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !addingEmail && addEmail()}
                disabled={addingEmail}
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={addEmail}
                disabled={addingEmail}
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70"
              >
                {addingEmail ? "Sending..." : "Add"}
              </button>
            </div>
            {data.inviteEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {data.inviteEmails.map((email) => (
                  <span
                    key={email}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          inviteEmails: data.inviteEmails.filter(
                            (e) => e !== email
                          ),
                        })
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Press Enter or click Add.
            </p>
          </div>
        </div>
      );

    // ─── Step 3 ───
    if (step === 3)
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Map your layout</h2>
            <p className="text-muted-foreground mt-1">
              Draw your irrigation area on satellite imagery, then upload your
              irrigation drawing for processing.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-border overflow-hidden shadow-lg bg-white">
            <MapContainer
              center={DUBAI_CENTER}
              zoom={12}
              style={{ height: "400px", width: "100%" }}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              />
              <FeatureGroup>
                <EditControl
                  position="topright"
                  onCreated={(e: any) => {
                    const layer = e.layer;
                    const coords = layer.getLatLngs()[0] as L.LatLng[];
                    const polygonCoords = coords.map((c) => [
                      c.lng,
                    c.lat,
                  ]) as number[][];
                    const area = calculateArea(polygonCoords);
                    setManualPolygon(polygonCoords);
                    setLayoutConfirmed(false);
                    setData((prev) => ({
                      ...prev,
                      layout: {
                        ...prev.layout,
                        polygon: polygonCoords,
                        area_m2: area,
                      },
                    }));
                  }}
                  onEdited={(e: any) => {
                    const layer = e.layers.getLayers()[0] as L.Polygon;
                    const coords = layer.getLatLngs()[0] as L.LatLng[];
                    const polygonCoords = coords.map((c) => [
                      c.lng,
                      c.lat,
                    ]) as number[][];
                    const area = calculateArea(polygonCoords);
                    setManualPolygon(polygonCoords);
                    setLayoutConfirmed(false);
                    setData((prev) => ({
                      ...prev,
                      layout: {
                        ...prev.layout,
                        polygon: polygonCoords,
                        area_m2: area,
                      },
                    }));
                  }}
                  draw={{
                    polygon: true,
                    polyline: false,
                    circle: false,
                    rectangle: false,
                    marker: false,
                    circlemarker: false,
                  }}
                />
                {data.layout.polygon.length > 0 && (
                  <Polygon
                    positions={data.layout.polygon.map(([lng, lat]) => [
                      lat,
                      lng,
                    ])}
                    pathOptions={{ color: "blue" }}
                  />
                )}
              </FeatureGroup>
            </MapContainer>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 space-y-3">
            <p className="text-sm font-medium">
              {finalLayoutPolygon.length
                ? `Mapped area: ${formatArea(finalLayoutArea)}`
                : "Draw an area on the map to estimate its size."}
            </p>
            <input
              type="text"
              placeholder="Layout notes (optional)..."
              value={data.layout.notes}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, notes: e.target.value },
                }))
              }
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold">Manual Coordinates</p>
            <p className="text-xs text-muted-foreground">
              Paste coordinates as pairs (one line each), e.g. `55.2708, 25.2048`.
            </p>
            <textarea
              value={manualCoordsInput}
              onChange={(e) => setManualCoordsInput(e.target.value)}
              placeholder={"55.2708, 25.2048\n55.2720, 25.2048\n55.2720, 25.2060\n55.2708, 25.2060"}
              className="w-full h-28 px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {manualCoordsError && (
              <p className="text-xs text-destructive">{manualCoordsError}</p>
            )}
            <button
              type="button"
              onClick={applyManualCoordinates}
              className="w-full py-2.5 px-6 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors"
            >
              Apply Coordinates and Build Enclosure
            </button>
          </div>

          <div className="space-y-3 rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold">Irrigation Drawing Upload</p>
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, JPG, PNG, DWG, KML.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Coordinate System
              </label>
              <select
                value={crsMode}
                onChange={(e) => setCrsMode(e.target.value as CrsMode)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="auto">Auto detect</option>
                <option value="utm39n">UTM Zone 39N (EPSG:32639)</option>
                <option value="utm40n">UTM Zone 40N (EPSG:32640)</option>
                <option value="uae_grid">UAE Grid (EPSG:3997)</option>
              </select>
            </div>
            <input
              id="layout-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.kml,.dwg"
              className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/90 file:text-white file:font-medium hover:file:bg-primary"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] ?? null;
                if (!selectedFile) {
                  setData((prev) => ({
                    ...prev,
                    layout: { ...prev.layout, layoutFile: null },
                  }));
                  return;
                }

                const extension = selectedFile.name.split(".").pop()?.toLowerCase() || "";
                if (!supportedLayoutExtensions.includes(extension)) {
                  alert("Unsupported file type. Please upload PDF, JPG, PNG, DWG, or KML.");
                  e.target.value = "";
                  return;
                }

                setData((prev) => ({
                  ...prev,
                  layout: {
                    ...prev.layout,
                    layoutFile: selectedFile,
                  },
                }));
              }}
            />

            {data.layout.layoutFile && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                <p className="font-medium text-emerald-800">
                  {data.layout.layoutFile.name}
                </p>
                <p className="text-xs text-emerald-700">
                  {(data.layout.layoutFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            {extractedPoints.length > 0 && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-xs font-semibold">
                  Extracted Reference Points ({extractedPoints.filter((p) => p.enabled).length}/
                  {extractedPoints.length} enabled)
                </p>
                <div className="max-h-40 overflow-auto space-y-1">
                  {extractedPoints.map((point, index) => (
                    <label
                      key={point.id}
                      className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={point.enabled}
                        onChange={(e) => {
                          setLayoutConfirmed(false);
                          setExtractedPoints((prev) =>
                            prev.map((p) =>
                              p.id === point.id ? { ...p, enabled: e.target.checked } : p
                            )
                          );
                        }}
                      />
                      <span className="font-medium">P{index + 1}</span>
                      <span className="font-mono text-[11px]">
                        {point.lng.toFixed(6)}, {point.lat.toFixed(6)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLayoutUpload}
              disabled={!data.layout.layoutFile || uploadingLayout}
              className="w-full py-3 px-6 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingLayout ? "Uploading..." : "Upload to Processing Queue"}
            </button>

            <button
              type="button"
              onClick={handleLayoutUpload}
              disabled={!data.layout.layoutFile || uploadingLayout}
              className="w-full py-2.5 px-6 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reprocess with Current CRS
            </button>
            <p className="text-[11px] text-muted-foreground">
              Tip: choose a different coordinate system, then click reprocess to retry on the same selected file.
            </p>

            {(layoutTaskId || layoutTaskState !== "idle") && (
              <div
                className={`rounded-xl border p-3 text-xs ${
                  layoutTaskState === "ready"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : layoutTaskState === "failed"
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                <p className="font-semibold">
                  {layoutTaskState === "ready"
                    ? "Extraction completed"
                    : layoutTaskState === "failed"
                    ? "Extraction failed"
                    : "Extraction in progress"}
                </p>
                {layoutTaskId && <p>Task ID: {layoutTaskId}</p>}
                {layoutTaskMessage && <p>{layoutTaskMessage}</p>}
              </div>
            )}
          </div>

          {finalLayoutPolygon.length >= 3 && (
            <div className="space-y-4 rounded-2xl border border-border p-4 bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Final Layout Preview</p>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {finalLayoutSource === "document_refined"
                    ? "Source: Document refined"
                    : "Source: Manual draw"}
                </span>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <MapContainer
                  center={DUBAI_CENTER}
                  zoom={12}
                  style={{ height: "260px", width: "100%" }}
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri'
                  />
                  <FitMapToPoints points={finalLayoutLatLng} fallbackZoom={12} maxZoom={16} />
                  <Polygon
                    positions={finalLayoutPolygon.map(([lng, lat]) => [lat, lng])}
                    pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.25 }}
                  />
                </MapContainer>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Final area: {formatArea(finalLayoutArea)}
                </p>
                <label className="text-xs font-medium text-muted-foreground">
                  Final coordinates (lng, lat)
                </label>
                <textarea
                  readOnly
                  value={JSON.stringify(finalLayoutPolygon, null, 2)}
                  className="w-full h-28 px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleConfirmLayout}
                disabled={savingLayout}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  layoutConfirmed
                    ? "bg-emerald-600 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {savingLayout
                  ? "Saving layout..."
                  : layoutConfirmed
                  ? "Layout confirmed"
                  : "Confirm final layout and coordinates"}
              </button>


              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={clearManualPolygon}
                  disabled={manualPolygon.length < 3}
                  className="px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Drawn Polygon
                </button>
                <button
                  type="button"
                  onClick={clearExtractedPolygon}
                  disabled={extractedPolygon.length < 3 && extractedPoints.length < 3}
                  className="px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Extracted Result
                </button>
                <button
                  type="button"
                  onClick={clearLayoutSelection}
                  disabled={finalLayoutPolygon.length < 3 && !data.layout.layoutFile}
                  className="px-3 py-2 rounded-xl border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear All Selection
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {finalLayoutPolygon.length >= 3 && !layoutConfirmed
              ? "Please confirm final layout to continue."
              : finalLayoutPolygon.length >= 3 && layoutConfirmed
              ? "Layout confirmed. Continue to module selection."
              : "You can refine this map later from the dashboard."}
          </p>
        </div>
      );


    // ─── Step 4 ───
    if (step === 4)
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Choose your modules</h2>
            <p className="text-muted-foreground mt-1">
              Select features your team needs. You can change this later.
            </p>
          </div>

          {(recommendationLoading || recommendation || recommendationError) && (
            <div className={`rounded-2xl border p-4 space-y-3 ${
              recommendation
                ? "bg-primary/5 border-primary/20"
                : recommendationError
                ? "bg-rose-50 border-rose-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {recommendationLoading
                    ? "Analyzing your layout..."
                    : recommendation
                    ? "AI Recommendation"
                    : "Recommendation unavailable"}
                </p>
                {(recommendation || recommendationError) && (
                  <button
                    type="button"
                    onClick={() => void requestModuleRecommendation()}
                    disabled={recommendationLoading}
                    className="px-2.5 py-1 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Refresh
                  </button>
                )}
              </div>

              {recommendationLoading && (
                <p className="text-xs text-amber-700">
                  Generating recommendation from your layout coordinates...
                </p>
              )}

              {recommendationError && (
                <p className="text-xs text-rose-700">{recommendationError}</p>
              )}

              {recommendation && (
                <>
                  {recommendation.summary && (
                    <p className="text-xs text-muted-foreground">{recommendation.summary}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {recommendation.recommended_modules.map((moduleId) => (
                      <span
                        key={moduleId}
                        className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                      >
                        {MODULE_LABELS[moduleId] || moduleId}
                      </span>
                    ))}
                  </div>
                  {recommendation.recommended_modules.map((moduleId) =>
                    recommendation.module_reasons?.[moduleId] ? (
                      <p key={`reason-${moduleId}`} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {MODULE_LABELS[moduleId] || moduleId}:
                        </span>{" "}
                        {recommendation.module_reasons[moduleId]}
                      </p>
                    ) : null
                  )}
                  <button
                    type="button"
                    onClick={applyRecommendedModules}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Apply Recommended Modules
                  </button>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MODULES.map((mod) => {
              const selected = data.modules.includes(mod.id);
              const isRecommended = recommendation?.recommended_modules.includes(mod.id);
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => toggleModule(mod.id)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{mod.label}</p>
                        {isRecommended && (
                          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{mod.desc}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {selected && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );

    // ─── Step 5 ───
    if (step === 5)
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Connect your gateway</h2>
            <p className="text-muted-foreground mt-1">
              Enter gateway ID to load remembered microcontrollers and connected field devices.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border p-4">
            <label className="text-sm font-medium">Gateway ID</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={data.gatewayProtocol}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, gatewayProtocol: e.target.value }))
                }
                className="px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="mqtt">MQTT</option>
                <option value="modbus">Modbus</option>
                <option value="lwm2m">LwM2M</option>
                <option value="opcua">OPC-UA</option>
                <option value="bacnet">BACnet</option>
                <option value="lorawan">LoRaWAN</option>
              </select>
              <input
                type="text"
                placeholder="Gateway identifier (client_id / serial / gateway_id)"
                value={data.gatewayId}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, gatewayId: e.target.value }))
                }
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleGatewayDiscover}
                disabled={discoveringGateway}
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {discoveringGateway ? "Scanning..." : "Load Devices"}
              </button>
            </div>
            {gatewayError && <p className="text-xs text-destructive">{gatewayError}</p>}
            {!gatewayError && (
              <p className="text-xs text-muted-foreground">
                Uses ThingsBoard live discovery by selected protocol and gateway identity attributes.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              You can skip gateway setup now and complete scan/register later from settings.
            </p>
            <button
              type="button"
              onClick={() => setStep(goToNextVisibleStep(5))}
              className="mt-2 px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              Skip for now
            </button>
          </div>

          {data.devices.length > 0 && (
            <>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800">
                  {data.devices.length} devices discovered from gateway
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {discoveredMicrocontrollers.length} microcontrollers mapped to gateway inventory
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Source: {gatewaySource || "unknown"}
                </p>
                {missingCoordinates.length > 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    {missingCoordinates.length} device(s) skipped: missing lat/lng attributes in ThingsBoard.
                  </p>
                )}
              </div>

              {geolocatedDevices.length > 0 ? (
                <div className="rounded-2xl border-2 border-border overflow-hidden bg-white">
                  <MapContainer
                    center={DUBAI_CENTER}
                    zoom={12}
                    style={{ height: "300px", width: "100%" }}
                  >
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles &copy; Esri"
                    />
                    <FitMapToPoints points={gatewayMapFocusPoints} fallbackZoom={12} maxZoom={16} />
                    {data.layout.polygon.length > 2 && (
                      <Polygon
                        positions={data.layout.polygon.map(([lng, lat]) => [lat, lng])}
                        pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.2 }}
                      />
                    )}
                    {pipelineLinePositions.length > 1 && (
                      <Polyline
                        positions={pipelineLinePositions}
                        pathOptions={{ color: "#f59e0b", weight: 4, opacity: 0.9 }}
                      />
                    )}
                    {geolocatedDevices.map((device) => {
                      const sharedPopup = (
                        <Popup>
                          <div className="text-xs space-y-1">
                            <p className="font-semibold">{device.id}</p>
                            <p>{device.type}</p>
                            <p>
                              {device.metric}: {String(device.reading)}
                            </p>
                          </div>
                        </Popup>
                      );

                      if (isPressureDevice(device)) {
                        return (
                          <Polygon
                            key={device.id}
                            positions={buildDiamond(device.lat as number, device.lng as number)}
                            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.85, weight: 2 }}
                          >
                            {sharedPopup}
                          </Polygon>
                        );
                      }

                      return (
                        <CircleMarker
                          key={device.id}
                          center={[device.lat as number, device.lng as number]}
                          radius={6}
                          pathOptions={{ color: "#ef4444", fillOpacity: 0.85 }}
                        >
                          {sharedPopup}
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                  No geolocated devices to render. Add `lat` and `lng` server attributes in ThingsBoard devices.
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold">Discovered devices</p>
                <div className="max-h-56 overflow-auto rounded-xl border border-border divide-y">
                  {data.devices.map((device) => (
                    <div key={device.id} className="p-3 text-xs grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <span className="font-medium">{device.id}</span>
                      <span>{device.type}</span>
                      <span>{device.metric}: {String(device.reading)}</span>
                      <span>
                        {typeof device.lat === "number" && typeof device.lng === "number"
                          ? `${device.lat.toFixed(6)}, ${device.lng.toFixed(6)}`
                          : "No coordinates"}
                      </span>
                      <span className="text-emerald-700">{device.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Microcontroller inventory</p>
                <div className="max-h-48 overflow-auto rounded-xl border border-border divide-y">
                  {discoveredMicrocontrollers.map((mcu) => (
                    <div key={mcu.id} className="p-3 text-xs space-y-1">
                      <p className="font-medium">{mcu.id}</p>
                      <p className="text-muted-foreground">
                        Devices: {mcu.device_ids.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmDevices}
                disabled={confirmingDevices || data.devices.length === 0}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  devicesConfirmed
                    ? "bg-emerald-600 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {confirmingDevices
                  ? "Saving devices..."
                  : devicesConfirmed
                  ? "Devices confirmed and saved"
                  : "Confirm devices and save"}
              </button>
            </>
          )}
        </div>
      );

    if (step === 6)
      return (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold">Demand forecasting setup</h2>
            <p className="text-muted-foreground mt-1">
              Enter crop/plant counts and irrigation systems to improve demand modeling.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border p-4 bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">One-week weather forecast</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                Based on your confirmed layout
              </span>
            </div>

            {!layoutConfirmed && (
              <p className="text-xs text-muted-foreground">
                Confirm your layout boundary first to auto-detect location and load weather.
              </p>
            )}

            {layoutConfirmed && (
              <>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    <span className="font-medium">Detected location:</span>{" "}
                    <span>{detectedLayoutPlace || "Detecting..."}</span>
                  </div>
                  {detectedLayoutCoords && (
                    <div className="font-mono">
                      {detectedLayoutCoords.lat.toFixed(5)}, {detectedLayoutCoords.lng.toFixed(5)}
                    </div>
                  )}
                </div>

                {weatherStatus === "loading" && (
                  <p className="text-xs text-muted-foreground">Loading forecast...</p>
                )}

                {weatherStatus === "error" && (
                  <p className="text-xs text-destructive">{weatherError || "Failed to load forecast."}</p>
                )}

                {weatherStatus === "ready" && weeklyForecast && (
                  <div className="rounded-xl border border-border overflow-hidden bg-background">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Day</th>
                          <th className="text-left p-2">Min °C</th>
                          <th className="text-left p-2">Max °C</th>
                          <th className="text-left p-2">Precip (mm)</th>
                          <th className="text-left p-2">Wind max (km/h)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyForecast.time.map((day, idx) => (
                          <tr key={day} className="border-t border-border">
                            <td className="p-2 font-mono">
                              {new Date(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            </td>
                            <td className="p-2">{Number(weeklyForecast.temperature_2m_min[idx] ?? 0).toFixed(1)}</td>
                            <td className="p-2">{Number(weeklyForecast.temperature_2m_max[idx] ?? 0).toFixed(1)}</td>
                            <td className="p-2">{Number(weeklyForecast.precipitation_sum[idx] ?? 0).toFixed(1)}</td>
                            <td className="p-2">{Number(weeklyForecast.windspeed_10m_max[idx] ?? 0).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Plants / Crops</h3>
              <button
                type="button"
                onClick={addPlantRow}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
              >
                Add row
              </button>
            </div>
            <div className="space-y-2">
              {data.demandForecasting.plants.map((row, index) => (
                <div key={`plant-${index}`} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Plant/Crop type"
                    value={row.name}
                    onChange={(e) => updatePlantRow(index, { name: e.target.value })}
                    className="col-span-7 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Quantity"
                    value={row.quantity}
                    onChange={(e) =>
                      updatePlantRow(index, {
                        quantity: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="col-span-3 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removePlantRow(index)}
                    className="col-span-2 px-2 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Water Systems</h3>
              <button
                type="button"
                onClick={addWaterSystemRow}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
              >
                Add row
              </button>
            </div>
            <div className="space-y-2">
              {data.demandForecasting.waterSystems.map((row, index) => (
                <div key={`water-${index}`} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="System name (e.g. Sprinkler, Drip Tube)"
                    value={row.name}
                    onChange={(e) => updateWaterSystemRow(index, { name: e.target.value })}
                    className="col-span-7 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Quantity"
                    value={row.quantity}
                    onChange={(e) =>
                      updateWaterSystemRow(index, {
                        quantity: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="col-span-3 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeWaterSystemRow(index)}
                    className="col-span-2 px-2 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    // ─── Step 7 ───
    if (step === 7)
      return (
        <div className="text-center space-y-8 py-4">
          <div className="space-y-3">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Your workspace is ready</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              AquaNex has been configured for{" "}
              <strong>{data.workspaceName || data.companyName || "your organization"}</strong>.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
            {[
              { label: "Workspace", value: data.workspaceName || "—" },
              { label: "Organization", value: data.companyName || "—" },
              { label: "Team Size", value: data.teamSize || "Not set" },
              {
                label: "Invites Sent",
                value: data.inviteEmails.length
                  ? `${data.inviteEmails.length} member(s)`
                  : "None",
              },
              {
                label: "Modules",
                value: `${data.modules.length} enabled`,
              },
              {
                label: "Layout Area",
                value: data.layout.polygon.length
                  ? formatArea(data.layout.area_m2)
                  : "Not mapped",
              },
              {
                label: "Devices",
                value: data.devices.length
                  ? `${data.devices.length} discovered`
                  : "Not discovered",
              },
              {
                label: "Gateway",
                value: data.gatewayId || "Not connected",
              },
              {
                label: "Plant Entries",
                value: `${buildDemandForecastingPayload().plants.length}`,
              },
              {
                label: "System Entries",
                value: `${buildDemandForecastingPayload().waterSystems.length}`,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="p-4 rounded-2xl bg-muted/50 space-y-1"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-medium text-sm truncate">{value}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleFinish}
            disabled={saving}
            className="px-10 py-4 bg-primary text-primary-foreground rounded-2xl text-base font-semibold hover:bg-primary/90 transition-all shadow-lg disabled:opacity-60"
          >
            {saving ? "Saving..." : "Go to Dashboard"}
          </button>
        </div>
      );
  };

  return (
    <div className="relative min-h-screen py-10 px-4
  bg-[radial-gradient(ellipse_at_top_left,_#ecfeff_0%,_#f0fdfa_35%,_#e0f2fe_70%,_#f8fafc_100%)]
  dark:bg-[radial-gradient(ellipse_at_top_left,_#042f2e_0%,_#0c1a2e_40%,_#061220_70%,_#020d18_100%)]
  transition-colors duration-300">
  <LeafDecor />

      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          {visibleSteps.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg scale-110"
                        : isDone
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-xs hidden sm:block ${
                      isActive
                        ? "text-primary font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {index < visibleSteps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${
                      isDone ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-8 md:p-10">
          {renderStep()}
        </div>

        {step < lastVisibleStepId && (
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => goToPreviousVisibleStep(s))}
              disabled={step === 1}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => goToNextVisibleStep(s))}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next Step{" "}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
