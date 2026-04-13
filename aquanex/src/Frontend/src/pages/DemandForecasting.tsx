import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Breadcrumbs from "@/components/Breadcrumbs";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, CloudSun, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MapContainer, Polygon, TileLayer, Tooltip, useMap, CircleMarker, Popup } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { useModuleDeviceSetup } from "@/hooks/useModuleDeviceSetup";
import api from "@/lib/api";
import "leaflet/dist/leaflet.css";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const FitMapToPointsOnce = ({
  points,
  fallbackCenter = DUBAI_CENTER,
  fallbackZoom = 12,
  maxZoom = 16,
}: {
  points: [number, number][];
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
  maxZoom?: number;
}) => {
  const map = useMap();
  const lastKeyRef = useRef<string>("");
  const key = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join("|");

  useEffect(() => {
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    if (points.length === 0) {
      map.setView(fallbackCenter, fallbackZoom);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], Math.min(maxZoom, 15));
      return;
    }
    map.fitBounds(points, { padding: [42, 42], maxZoom });
  }, [fallbackCenter, fallbackZoom, key, map, maxZoom, points]);

  return null;
};

const forecastData = [
  {
    zone: "Zone A - North Field",
    currentUsage: 1250,
    predictedUsage: 1450,
    trend: "increase",
    confidence: 92,
    recommendation: "Increase water allocation by 16%",
    status: "warning"
  },
  {
    zone: "Zone B - South Field",
    currentUsage: 980,
    predictedUsage: 850,
    trend: "decrease",
    confidence: 88,
    recommendation: "Reduce allocation, optimize schedule",
    status: "optimal"
  },
  {
    zone: "Zone C - East Field",
    currentUsage: 1100,
    predictedUsage: 1380,
    trend: "increase",
    confidence: 95,
    recommendation: "Prepare for 25% increase in demand",
    status: "warning"
  },
  {
    zone: "Zone D - West Field",
    currentUsage: 1500,
    predictedUsage: 1520,
    trend: "stable",
    confidence: 90,
    recommendation: "Maintain current irrigation schedule",
    status: "optimal"
  }
];

const weeklyForecast = Array.from({ length: 7 }).map((_, idx) => {
  const d = new Date();
  d.setDate(d.getDate() + idx);
  const demandBase = [4200, 4100, 3900, 4300, 4500, 4000, 3800][idx] || 4000;
  const predictedBase = [4350, 4500, 3800, 4200, 4600, 3900, 3700][idx] || 4000;
  const weatherBase = ["Sunny", "Sunny", "Cloudy", "Sunny", "Hot", "Cloudy", "Mild"][idx] || "Sunny";
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    demand: demandBase,
    predicted: predictedBase,
    weather: weatherBase,
  };
});

const insights = [
  {
    title: "Peak Demand Expected",
    description: "Friday will see highest demand due to elevated temperatures",
    type: "warning",
    impact: "High"
  },
  {
    title: "Optimal Efficiency Window",
    description: "Wednesday-Saturday shows lower evaporation rates",
    type: "success",
    impact: "Medium"
  },
  {
    title: "Weather Pattern Alert",
    description: "Extended dry period forecasted for next 10 days",
    type: "critical",
    impact: "High"
  }
];

const weatherCodeLabel = (code?: string | null) => {
  const map: Record<string, string> = {
    "Clear": "Clear",
    "Clouds": "Cloudy",
    "Few clouds": "Few Clouds",
    "Scattered clouds": "Scattered",
    "Broken clouds": "Broken",
    "Overcast": "Overcast",
    "Mist": "Mist",
    "Fog": "Fog",
    "Haze": "Haze",
    "Smoke": "Smoke",
    "Dust": "Dust",
    "Sand": "Sand",
    "Ash": "Ash",
    "Squall": "Squall",
    "Tornado": "Tornado",
    "Rain": "Rain",
    "Drizzle": "Drizzle",
    "Shower rain": "Rain Showers",
    "Thunderstorm": "Thunderstorm",
    "Snow": "Snow",
    "Light snow": "Light Snow",
    "Heavy snow": "Heavy Snow",
    "Sleet": "Sleet",
    "Light rain": "Light Rain",
    "Moderate rain": "Moderate Rain",
    "Heavy rain": "Heavy Rain",
  };
  if (typeof code !== "string") return "Unknown";
  return map[code] || code;
};

const normalizeLocationQueries = (rawLocation: string): string[] => {
  const base = String(rawLocation || "").trim();
  if (!base) return [];
  const parts = base
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const dedupedAdjacent = parts.filter((part, idx) => idx === 0 || part.toLowerCase() !== parts[idx - 1].toLowerCase());
  const shortlist = [
    dedupedAdjacent.join(", "),
    dedupedAdjacent.slice(0, 2).join(", "),
    dedupedAdjacent.slice(0, 1).join(", "),
    parts.join(", "),
  ]
    .map((q) => q.trim())
    .filter(Boolean);
  return [...new Set(shortlist)];
};

type LatLngPoint = [number, number];

const toXY = ([lat, lng]: LatLngPoint) => ({ x: lng, y: lat });
const toLatLng = ({ x, y }: { x: number; y: number }): LatLngPoint => [y, x];

const clipPolygonWithRect = (
  polygon: LatLngPoint[],
  rect: { minX: number; maxX: number; minY: number; maxY: number }
): LatLngPoint[] => {
  if (polygon.length < 3) return [];

  const clipEdge = (
    input: Array<{ x: number; y: number }>,
    inside: (p: { x: number; y: number }) => boolean,
    intersect: (a: { x: number; y: number }, b: { x: number; y: number }) => { x: number; y: number }
  ) => {
    const output: Array<{ x: number; y: number }> = [];
    if (input.length === 0) return output;
    let prev = input[input.length - 1];
    let prevInside = inside(prev);
    for (const curr of input) {
      const currInside = inside(curr);
      if (currInside) {
        if (!prevInside) output.push(intersect(prev, curr));
        output.push(curr);
      } else if (prevInside) {
        output.push(intersect(prev, curr));
      }
      prev = curr;
      prevInside = currInside;
    }
    return output;
  };

  const intersectVertical = (xEdge: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-12) return { x: xEdge, y: a.y };
    const t = (xEdge - a.x) / dx;
    return { x: xEdge, y: a.y + t * (b.y - a.y) };
  };

  const intersectHorizontal = (yEdge: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) < 1e-12) return { x: a.x, y: yEdge };
    const t = (yEdge - a.y) / dy;
    return { x: a.x + t * (b.x - a.x), y: yEdge };
  };

  let output = polygon.map(toXY);
  output = clipEdge(output, (p) => p.x >= rect.minX, (a, b) => intersectVertical(rect.minX, a, b));
  output = clipEdge(output, (p) => p.x <= rect.maxX, (a, b) => intersectVertical(rect.maxX, a, b));
  output = clipEdge(output, (p) => p.y >= rect.minY, (a, b) => intersectHorizontal(rect.minY, a, b));
  output = clipEdge(output, (p) => p.y <= rect.maxY, (a, b) => intersectHorizontal(rect.maxY, a, b));

  const latLng = output.map(toLatLng);
  const deduped: LatLngPoint[] = [];
  for (const point of latLng) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev[0] - point[0]) > 1e-8 || Math.abs(prev[1] - point[1]) > 1e-8) {
      deduped.push(point);
    }
  }
  if (deduped.length > 1) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-8 && Math.abs(first[1] - last[1]) < 1e-8) {
      deduped.pop();
    }
  }
  return deduped.length >= 3 ? deduped : [];
};

const DemandForecasting = () => {
  const { workspace } = useAuth();
  const [forceSetup, setForceSetup] = useState(false);
  const [wasScanning, setWasScanning] = useState(false);
  const moduleSetup = useModuleDeviceSetup(["soil_moisture_sensor"]);
  const {
    gatewayIdInput,
    setGatewayIdInput,
    scanning,
    error,
    scanStatus,
    missingTypes,
    geolocatedModuleDevices,
    isConfigured,
    stripModuleDevices,
  } = moduleSetup;
  const deviceTypeLabels: Record<string, string> = {
    soil_moisture_sensor: "Soil Moisture Sensor",
  };
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [weatherData, setWeatherData] = useState<any>(null);
  const [zonePlants, setZonePlants] = useState<Array<{ zone: string; plants: Array<{ name: string; count: number }> }>>([
    { zone: "Zone A", plants: [{ name: "", count: 0 }] },
  ]);
  const [zoneForecastsAi, setZoneForecastsAi] = useState<any[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");

  useEffect(() => {
    if (scanning) setWasScanning(true);
  }, [scanning]);
  useEffect(() => {
    if (wasScanning && !scanning && !error && forceSetup) {
      setWasScanning(false);
      setForceSetup(false);
    }
  }, [error, forceSetup, scanning, wasScanning]);

  const handleStartRescan = async () => {
    setForceSetup(true);
    await stripModuleDevices();
  };

  const workspaceLocation = String(workspace?.location || "").trim();
  const companyName = String(workspace?.company_name || "").trim();
  const layoutPolygon = Array.isArray((workspace as any)?.layout_polygon) ? ((workspace as any).layout_polygon as any[]) : [];

  const layoutLatLng = useMemo<[number, number][]>(() => {
    return layoutPolygon
      .map((point: any) => [Number(point?.[1]), Number(point?.[0])] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }, [layoutPolygon]);

  const layoutCentroid = useMemo<{ lat: number; lng: number } | null>(() => {
    if (layoutLatLng.length < 3) return null;
    const sums = layoutLatLng.reduce(
      (acc, [lat, lng]) => ({ lat: acc.lat + lat, lng: acc.lng + lng, count: acc.count + 1 }),
      { lat: 0, lng: 0, count: 0 }
    );
    if (!sums.count) return null;
    return { lat: sums.lat / sums.count, lng: sums.lng / sums.count };
  }, [layoutLatLng]);
  const mapFocusPoints = useMemo<[number, number][]>(
    () => [...layoutLatLng, ...geolocatedModuleDevices.map((d: any) => [d.lat, d.lng] as [number, number])],
    [layoutLatLng, geolocatedModuleDevices]
  );

  const zonedLayout = useMemo(() => {
    if (layoutLatLng.length < 3) return [];
    const lats = layoutLatLng.map((p) => p[0]);
    const lngs = layoutLatLng.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;

    const zones = [
      { label: "Zone A", color: "#ef4444", rect: { minX: minLng, maxX: midLng, minY: midLat, maxY: maxLat } },
      { label: "Zone B", color: "#f59e0b", rect: { minX: midLng, maxX: maxLng, minY: midLat, maxY: maxLat } },
      { label: "Zone C", color: "#22c55e", rect: { minX: minLng, maxX: midLng, minY: minLat, maxY: midLat } },
      { label: "Zone D", color: "#3b82f6", rect: { minX: midLng, maxX: maxLng, minY: minLat, maxY: midLat } },
    ];

    return zones
      .map((zone) => ({
        ...zone,
        polygon: clipPolygonWithRect(layoutLatLng, zone.rect),
      }))
      .filter((zone) => zone.polygon.length >= 3);
  }, [layoutLatLng]);

  useEffect(() => {
    const fetchWeather = async () => {
      const apiBase = String(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
      const dubaiFallback = { lat: 25.2048, lng: 55.2708, name: "Dubai, AE" };
      let lat: number | null = null;
      let lng: number | null = null;
      let resolvedName = workspaceLocation || "Unknown Location";

      if (workspaceLocation) {
        const queries = normalizeLocationQueries(workspaceLocation);
        for (const query of queries) {
          try {
            const geoResp = await fetch(
              `${apiBase}/weather/geocode/?q=${encodeURIComponent(query)}`
            );
            if (!geoResp.ok) continue;
            const geoJson = await geoResp.json();
            if (
              typeof geoJson?.lat === "number" &&
              typeof geoJson?.lng === "number" &&
              Number.isFinite(geoJson.lat) &&
              Number.isFinite(geoJson.lng)
            ) {
              lat = geoJson.lat;
              lng = geoJson.lng;
              const place = [geoJson.name, geoJson.state, geoJson.country].filter(Boolean).join(", ");
              resolvedName = place || resolvedName;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if ((lat === null || lng === null) && layoutCentroid) {
        lat = layoutCentroid.lat;
        lng = layoutCentroid.lng;
        try {
          const revGeo = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
          const revData = await revGeo.json();
          if (revData && revData.city) {
            resolvedName = `${revData.city}, ${revData.principalSubdivision || revData.countryName}`;
          } else if (revData && revData.locality) {
            resolvedName = `${revData.locality}, ${revData.countryName}`;
          } else {
            resolvedName = "Layout Location";
          }
        } catch (e) {
          console.warn("Reverse geocode failed", e);
          resolvedName = "Layout Location";
        }
      }

      if (lat === null || lng === null) {
        lat = dubaiFallback.lat;
        lng = dubaiFallback.lng;
        resolvedName = dubaiFallback.name;
      }

      setWeatherLoading(true);
      setWeatherError("");
      try {
        const loadWeatherByCoords = async (targetLat: number, targetLng: number) => {
          const currentResp = await fetch(`${apiBase}/weather/current/?lat=${targetLat}&lng=${targetLng}`);
          if (!currentResp.ok) {
            const errData = await currentResp.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to fetch current weather");
          }
          const currentData = await currentResp.json();

          const forecastResp = await fetch(`${apiBase}/weather/forecast/?lat=${targetLat}&lng=${targetLng}`);
          if (!forecastResp.ok) {
            const errData = await forecastResp.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to fetch forecast");
          }
          const forecastData = await forecastResp.json();
          return { currentData, forecastData };
        };

        let weatherBundle: { currentData: any; forecastData: any };
        try {
          weatherBundle = await loadWeatherByCoords(lat, lng);
        } catch {
          lat = dubaiFallback.lat;
          lng = dubaiFallback.lng;
          resolvedName = dubaiFallback.name;
          weatherBundle = await loadWeatherByCoords(lat, lng);
        }

        const currentData = weatherBundle.currentData;
        const forecastData = weatherBundle.forecastData;

        const daily = forecastData.daily || [];
        const sevenDay = daily.map((day: any) => ({
            date: new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            maxTemp: day.temp_max,
            minTemp: day.temp_min,
            weatherCode: day.weather_main,
            precip: day.precipitation_sum
        })).slice(0, 7);

        setWeatherData({
          current: currentData.current,
          locationName: currentData.location?.name || resolvedName || dubaiFallback.name,
          sevenDayForecast: sevenDay
        });
      } catch (err: any) {
        setWeatherError(err.message || "Failed to load weather data.");
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [workspaceLocation, layoutCentroid]);

  const getTrendIcon = (trend: any) => {
    if (trend === "increase") return <TrendingUp className="w-5 h-5 text-red-500" />;
    if (trend === "decrease") return <TrendingDown className="w-5 h-5 text-green-500" />;
    return <span className="text-blue-500">→</span>;
  };

  const getStatusColor = (status: any) => {
    switch (status) {
      case "optimal":
        return "bg-green-100 text-green-800 border-green-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getInsightIcon = (type: any) => {
    if (type === "success") return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (type === "critical") return <AlertTriangle className="w-5 h-5 text-red-500" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  const addZone = () => {
    setZonePlants((prev) => [...prev, { zone: `Zone ${String.fromCharCode(65 + prev.length)}`, plants: [{ name: "", count: 0 }] }]);
  };
  const addPlantField = (zoneIdx: number) => {
    setZonePlants((prev) =>
      prev.map((z, idx) => (idx === zoneIdx ? { ...z, plants: [...z.plants, { name: "", count: 0 }] } : z))
    );
  };
  const updatePlant = (zoneIdx: number, plantIdx: number, key: "name" | "count", value: string) => {
    setZonePlants((prev) =>
      prev.map((z, idx) => {
        if (idx !== zoneIdx) return z;
        return {
          ...z,
          plants: z.plants.map((p, pIdx) =>
            pIdx === plantIdx ? { ...p, [key]: key === "count" ? Number(value || 0) : value } : p
          ),
        };
      })
    );
  };
  const updateZoneName = (zoneIdx: number, value: string) => {
    setZonePlants((prev) => prev.map((z, idx) => (idx === zoneIdx ? { ...z, zone: value } : z)));
  };

  const requestDemandForecast = async () => {
    setForecastLoading(true);
    setForecastError("");
    try {
      const payload = {
        zones: zonePlants,
        weather_context: weatherData?.current || {},
      };
      const res = await api.post("/demand-forecast/assistant/", payload);
      const rows = Array.isArray(res.data?.zone_forecasts) ? res.data.zone_forecasts : [];
      setZoneForecastsAi(rows);
    } catch (err: any) {
      setForecastError(err?.response?.data?.error || "Failed to generate demand forecast.");
      setZoneForecastsAi([]);
    } finally {
      setForecastLoading(false);
    }
  };


  if (!isConfigured || forceSetup) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="container mx-auto px-6 py-8">
            <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Demand Forecasting" }]} />
            <h1 className="text-3xl font-bold text-gray-900 mb-2 mt-4">Predictive Water Demand Forecasting</h1>
            <p className="text-gray-600">
              AI-powered water demand predictions and optimization
              {companyName ? ` for ${companyName}` : ""}
            </p>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600" />
                Irrigation Space Layout
              </CardTitle>
              <CardDescription>Default layout and configured device coordinates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border overflow-hidden">
                <MapContainer center={DUBAI_CENTER} zoom={12} style={{ height: "360px", width: "100%" }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                  <FitMapToPointsOnce points={mapFocusPoints} fallbackZoom={12} maxZoom={16} />
                  {layoutLatLng.length >= 3 && (
                    <Polygon
                      positions={layoutLatLng}
                      pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.2 }}
                    />
                  )}
                  {geolocatedModuleDevices.map((device: any) => (
                    <CircleMarker
                      key={device.id}
                      center={[device.lat, device.lng]}
                      radius={6}
                      pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">{device.id}</p>
                          <p>{device.type}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{forceSetup ? "Rescan Devices" : "Devices Not Configured"}</CardTitle>
                {forceSetup && (
                  <Button variant="outline" size="sm" onClick={() => setForceSetup(false)}>Cancel</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure required demand forecasting devices to continue.
              </p>
              <p className="text-sm">
                Missing: {missingTypes.map((type) => deviceTypeLabels[type] || type).join(", ")}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={gatewayIdInput}
                  onChange={(event) => setGatewayIdInput(event.target.value)}
                  placeholder="Gateway ID"
                  className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-sm"
                />
                <Button onClick={() => moduleSetup.scanAndConfigure({ rescan: forceSetup })} disabled={scanning}>
                  {scanning ? "Scanning..." : forceSetup ? "Rescan Devices" : "Configure Devices"}
                </Button>
              </div>
              {scanStatus && <p className="text-xs text-muted-foreground">{scanStatus}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Demand Forecasting" }]} />
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2 mt-4">Predictive Water Demand Forecasting</h1>
          <p className="text-gray-600">
            AI-powered water demand predictions and optimization
            {companyName ? ` for ${companyName}` : ""}
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={handleStartRescan}>Rescan Devices</Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-blue-600" />
              Live Weather Context
            </CardTitle>
            <CardDescription>
              {companyName ? `${companyName} • ` : ""}
              {weatherData?.locationName || workspaceLocation || "Location Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {weatherLoading ? (
              <p className="text-sm text-muted-foreground">Fetching live weather...</p>
            ) : weatherError ? (
              <p className="text-sm text-destructive">{weatherError}</p>
            ) : weatherData?.current ? (
              <div className="space-y-6">
                {/* Current Weather Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Condition</p>
                    <p className="text-lg font-semibold">{weatherCodeLabel(weatherData.current.weather_main)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Temperature</p>
                    <p className="text-lg font-semibold">{Math.round(weatherData.current.temperature)}°C</p>
                    </div>
                    <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Humidity</p>
                    <p className="text-lg font-semibold">{weatherData.current.humidity}%</p>
                    </div>
                    <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Wind Speed</p>
                    <p className="text-lg font-semibold">{weatherData.current.wind_speed} m/s</p>
                    </div>
                </div>

                {/* 7-Day Forecast */}
                {weatherData.sevenDayForecast && weatherData.sevenDayForecast.length > 0 && (
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <CloudSun className="w-4 h-4 text-primary" />
                            7-Day Forecast
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
                            {weatherData.sevenDayForecast.map((day: any, idx: number) => (
                                <div key={idx} className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30 border border-border text-center">
                                    <span className="text-xs font-medium text-muted-foreground mb-1">{day.date}</span>
                                    <span className="text-sm font-bold mb-1">{Math.round(day.maxTemp)}° / {Math.round(day.minTemp)}°</span>
                                    <span className="text-xs text-muted-foreground truncate w-full" title={weatherCodeLabel(day.weatherCode)}>
                                        {weatherCodeLabel(day.weatherCode)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No weather data available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              Irrigation Space Layout
            </CardTitle>
            <CardDescription>Map View</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden">
              <MapContainer center={DUBAI_CENTER} zoom={12} style={{ height: "360px", width: "100%" }}>
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri"
                />
                <FitMapToPointsOnce points={mapFocusPoints} fallbackZoom={12} maxZoom={16} />
                {zonedLayout.length > 0 ? (
                  zonedLayout.map((zone) => (
                    <Polygon
                      key={zone.label}
                      positions={zone.polygon}
                      pathOptions={{ color: zone.color, weight: 2, fillOpacity: 0.22 }}
                    >
                      <Tooltip sticky>{zone.label}</Tooltip>
                    </Polygon>
                  ))
                ) : layoutLatLng.length >= 3 ? (
                  <Polygon
                    positions={layoutLatLng}
                    pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.2 }}
                  />
                ) : null}
                {geolocatedModuleDevices.map((device: any) => (
                  <CircleMarker
                    key={device.id}
                    center={[device.lat, device.lng]}
                    radius={6}
                    pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">{device.id}</p>
                        <p>{device.type}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            {layoutLatLng.length < 3 && (
              <p className="text-xs text-muted-foreground mt-2">
                Layout polygon not set. Showing pipelines/devices by coordinates.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Overview Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Current Total Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">4,830L</div>
              <p className="text-xs text-gray-500 mt-1">Per hour across all zones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Predicted Demand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">5,200L</div>
              <p className="text-xs text-gray-500 mt-1">Next 24 hours forecast</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Forecast Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">91%</div>
              <p className="text-xs text-gray-500 mt-1">Based on historical data</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Potential Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600">18%</div>
              <p className="text-xs text-gray-500 mt-1">With optimized scheduling</p>
            </CardContent>
          </Card>
        </div>

        {/* Zone Forecasts */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Plant Inputs by Zone</CardTitle>
            <CardDescription>Enter number of plants and names to generate demand forecast with current weather context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {zonePlants.map((zone, zoneIdx) => (
              <div key={zoneIdx} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    value={zone.zone}
                    onChange={(e) => updateZoneName(zoneIdx, e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm w-40"
                    placeholder="Zone Name"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => addPlantField(zoneIdx)}>
                    Add Plant
                  </Button>
                </div>
                {zone.plants.map((plant, plantIdx) => (
                  <div key={plantIdx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      value={plant.name}
                      onChange={(e) => updatePlant(zoneIdx, plantIdx, "name", e.target.value)}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      placeholder="Plant name"
                    />
                    <input
                      type="number"
                      value={plant.count || ""}
                      onChange={(e) => updatePlant(zoneIdx, plantIdx, "count", e.target.value)}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      placeholder="Number of plants"
                      min={0}
                    />
                  </div>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addZone}>Add Zone</Button>
              <Button type="button" onClick={requestDemandForecast} disabled={forecastLoading}>
                {forecastLoading ? "Generating..." : "Generate Forecast"}
              </Button>
            </div>
            {forecastError && <p className="text-sm text-destructive">{forecastError}</p>}
          </CardContent>
        </Card>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Zone-Level Forecasts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(zoneForecastsAi.length > 0
              ? zoneForecastsAi.map((row: any) => ({
                  zone: row.zone,
                  currentUsage: Math.round((Number(row.daily_demand_liters) || 0) * 0.88),
                  predictedUsage: Math.round(Number(row.daily_demand_liters) || 0),
                  trend: Number(row.daily_demand_liters) > 1200 ? "increase" : "stable",
                  confidence: 90,
                  recommendation: row.recommendation || "Adjust irrigation based on weather and plant mix.",
                  status: row.risk === "high" ? "warning" : row.risk === "low" ? "optimal" : "warning",
                  weather: row.weather,
                }))
              : forecastData).map((zone, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{zone.zone}</CardTitle>
                      <CardDescription className="text-sm text-gray-500 mt-1">
                        7-day forecast analysis{(zone as any).weather ? ` • Weather: ${(zone as any).weather}` : ""}
                      </CardDescription>
                    </div>
                    <Badge className={`${getStatusColor(zone.status)} border`}>
                      {zone.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Current vs Predicted */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Current Usage</p>
                        <p className="text-2xl font-bold text-gray-900">{zone.currentUsage}L</p>
                        <p className="text-xs text-gray-500 mt-1">per hour</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Predicted Usage</p>
                        <p className="text-2xl font-bold text-blue-600">{zone.predictedUsage}L</p>
                        <p className="text-xs text-gray-500 mt-1">per hour</p>
                      </div>
                    </div>

                    {/* Trend & Confidence */}
                    <div className="flex justify-between items-center py-3 border-t border-b">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(zone.trend)}
                        <span className="text-sm font-medium text-gray-700">
                          {zone.trend === "increase" ? "Increasing Demand" :
                           zone.trend === "decrease" ? "Decreasing Demand" :
                           "Stable Demand"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Confidence:</span>
                        <span className="text-sm font-bold text-gray-900">{zone.confidence}%</span>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-teal-50 p-4 rounded-lg">
                      <p className="text-xs font-semibold text-teal-900 mb-1">AI Recommendation</p>
                      <p className="text-sm text-teal-800">{zone.recommendation}</p>
                    </div>

                    {/* Action Button */}
                    <button className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors mt-2">
                      View Detailed Forecast
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Weekly Forecast Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>7-Day Water Demand Forecast</CardTitle>
            <CardDescription>Predicted vs actual usage patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weeklyForecast.map((day, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-20 text-sm font-medium text-gray-700">{day.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                        <div 
                          className="bg-teal-500 h-full rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${(day.demand / 5000) * 100}%` }}
                        >
                          <span className="text-xs font-medium text-white">{day.demand}L</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs w-20 justify-center">
                        {day.weather}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                        <div 
                          className="bg-blue-400 h-full rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${(day.predicted / 5000) * 100}%` }}
                        >
                          <span className="text-xs font-medium text-white">{day.predicted}L</span>
                        </div>
                      </div>
                      <div className="w-20 text-xs text-gray-500 text-center">Predicted</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle>AI-Powered Insights</CardTitle>
            <CardDescription>Automated recommendations based on weather patterns and historical data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="mt-1">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                      <Badge variant="outline" className={`text-xs ${
                        insight.impact === "High" ? "border-red-300 text-red-700" :
                        insight.impact === "Medium" ? "border-yellow-300 text-yellow-700" :
                        "border-gray-300 text-gray-700"
                      }`}>
                        {insight.impact} Impact
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DemandForecasting;
