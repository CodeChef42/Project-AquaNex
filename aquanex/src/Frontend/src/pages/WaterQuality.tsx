import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Droplet, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MapContainer, Polygon, TileLayer, useMap, CircleMarker, Popup } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { useModuleDeviceSetup } from "@/hooks/useModuleDeviceSetup";
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

const waterQualityData = [
  {
    id: "zone-a-north-field",
    zone: "Zone A - North Field",
    ph: 7.2,
    tds: 320,
    turbidity: 2.1,
    chlorine: 0.5,
    status: "optimal",
    lastUpdated: "2 mins ago"
  },
  {
    id: "zone-b-south-field",
    zone: "Zone B - South Field",
    ph: 6.8,
    tds: 450,
    turbidity: 4.5,
    chlorine: 0.3,
    status: "warning",
    lastUpdated: "5 mins ago"
  },
  {
    id: "zone-c-east-field",
    zone: "Zone C - East Field",
    ph: 7.5,
    tds: 280,
    turbidity: 1.8,
    chlorine: 0.6,
    status: "optimal",
    lastUpdated: "3 mins ago"
  },
  {
    id: "zone-d-west-field",
    zone: "Zone D - West Field",
    ph: 8.2,
    tds: 580,
    turbidity: 6.2,
    chlorine: 0.2,
    status: "critical",
    lastUpdated: "1 min ago"
  }
];

const parameterRanges = {
  ph: { optimal: [6.5, 7.5], warning: [6.0, 8.0] },
  tds: { optimal: [0, 400], warning: [400, 500] },
  turbidity: { optimal: [0, 3], warning: [3, 5] },
  chlorine: { optimal: [0.4, 0.8], warning: [0.2, 1.0] }
};

const WaterQualityMonitoring = () => {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState(null);
  const moduleSetup = useModuleDeviceSetup(["ph_sensor", "turbidity_sensor"]);
  const {
    gatewayIdInput,
    setGatewayIdInput,
    scanning,
    error,
    missingTypes,
    geolocatedModuleDevices,
    isConfigured,
  } = moduleSetup;
  const deviceTypeLabels: Record<string, string> = {
    ph_sensor: "pH Sensor",
    turbidity_sensor: "Turbidity Sensor",
  };
  const layoutPolygon = Array.isArray((workspace as any)?.layout_polygon) ? ((workspace as any).layout_polygon as any[]) : [];
  const layoutLatLng = useMemo<[number, number][]>(() => {
    return layoutPolygon
      .map((point: any) => [Number(point?.[1]), Number(point?.[0])] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }, [layoutPolygon]);
  const mapFocusPoints = useMemo<[number, number][]>(
    () => [...layoutLatLng, ...geolocatedModuleDevices.map((d: any) => [d.lat, d.lng] as [number, number])],
    [layoutLatLng, geolocatedModuleDevices]
  );

  const getStatusColor = (status) => {
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

  const getParameterStatus = (parameter, value) => {
    const ranges = parameterRanges[parameter];
    if (!ranges) return "unknown";
    
    if (value >= ranges.optimal[0] && value <= ranges.optimal[1]) {
      return "optimal";
    } else if (value >= ranges.warning[0] && value <= ranges.warning[1]) {
      return "warning";
    } else {
      return "critical";
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="container mx-auto px-6 py-8">
            <nav className="text-sm text-gray-500 mb-4">
              <a href="/" className="hover:text-teal-600">Home</a>
              <span className="mx-2">›</span>
              <span className="text-gray-900">Water Quality</span>
            </nav>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Water Quality Monitoring</h1>
            <p className="text-gray-600">Real-time water quality analysis and management</p>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-teal-600" />
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
              <CardTitle>Devices Not Configured</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure required water quality devices to continue.
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
                <Button onClick={moduleSetup.scanAndConfigure} disabled={scanning}>
                  {scanning ? "Scanning..." : "Configure Devices"}
                </Button>
              </div>
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
          <nav className="text-sm text-gray-500 mb-4">
            <a href="/" className="hover:text-teal-600">Home</a>
            <span className="mx-2">›</span>
            <span className="text-gray-900">Water Quality</span>
          </nav>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Water Quality Monitoring</h1>
          <p className="text-gray-600">Real-time water quality analysis and management</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Zones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">4</div>
              <p className="text-xs text-gray-500 mt-1">Active monitoring</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Optimal Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">2</div>
              <p className="text-xs text-gray-500 mt-1">Zones performing well</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">1</div>
              <p className="text-xs text-gray-500 mt-1">Requires attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">1</div>
              <p className="text-xs text-gray-500 mt-1">Immediate action needed</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-teal-600" />
              Irrigation Space Layout
            </CardTitle>
            <CardDescription>Map View</CardDescription>
          </CardHeader>
          <CardContent>
            {layoutLatLng.length >= 3 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <MapContainer center={DUBAI_CENTER} zoom={12} style={{ height: "360px", width: "100%" }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                  <FitMapToPointsOnce points={mapFocusPoints} fallbackZoom={12} maxZoom={16} />
                  <Polygon
                    positions={layoutLatLng}
                    pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.2 }}
                  />
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
            ) : (
              <p className="text-sm text-muted-foreground">
                No layout polygon saved for this workspace yet. Set it in onboarding.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Zone Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {waterQualityData.map((zone, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{zone.zone}</CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1">
                      Updated {zone.lastUpdated}
                    </CardDescription>
                  </div>
                  <Badge className={`${getStatusColor(zone.status)} border`}>
                    {zone.status === "optimal" && <CheckCircle className="w-3 h-3 mr-1" />}
                    {zone.status === "warning" && <AlertCircle className="w-3 h-3 mr-1" />}
                    {zone.status === "critical" && <AlertCircle className="w-3 h-3 mr-1" />}
                    {zone.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* pH Level */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Droplet className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700">pH Level</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-gray-900">{zone.ph}</span>
                      <Badge variant="outline" className={`text-xs ${
                        getParameterStatus("ph", zone.ph) === "optimal" ? "bg-green-50 text-green-700" :
                        getParameterStatus("ph", zone.ph) === "warning" ? "bg-yellow-50 text-yellow-700" :
                        "bg-red-50 text-red-700"
                      }`}>
                        {getParameterStatus("ph", zone.ph) === "optimal" ? "Normal" : 
                         getParameterStatus("ph", zone.ph) === "warning" ? "Elevated" : "High"}
                      </Badge>
                    </div>
                  </div>

                  {/* TDS */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-purple-500" />
                      <span className="text-sm font-medium text-gray-700">TDS (ppm)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-gray-900">{zone.tds}</span>
                      <Badge variant="outline" className={`text-xs ${
                        getParameterStatus("tds", zone.tds) === "optimal" ? "bg-green-50 text-green-700" :
                        getParameterStatus("tds", zone.tds) === "warning" ? "bg-yellow-50 text-yellow-700" :
                        "bg-red-50 text-red-700"
                      }`}>
                        {getParameterStatus("tds", zone.tds) === "optimal" ? "Normal" : 
                         getParameterStatus("tds", zone.tds) === "warning" ? "Moderate" : "High"}
                      </Badge>
                    </div>
                  </div>

                  {/* Turbidity */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 rounded-full bg-gray-300" />
                      <span className="text-sm font-medium text-gray-700">Turbidity (NTU)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-gray-900">{zone.turbidity}</span>
                      <Badge variant="outline" className={`text-xs ${
                        getParameterStatus("turbidity", zone.turbidity) === "optimal" ? "bg-green-50 text-green-700" :
                        getParameterStatus("turbidity", zone.turbidity) === "warning" ? "bg-yellow-50 text-yellow-700" :
                        "bg-red-50 text-red-700"
                      }`}>
                        {getParameterStatus("turbidity", zone.turbidity) === "optimal" ? "Clear" : 
                         getParameterStatus("turbidity", zone.turbidity) === "warning" ? "Cloudy" : "Very Cloudy"}
                      </Badge>
                    </div>
                  </div>

                  {/* Chlorine */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 rounded-full bg-teal-300" />
                      <span className="text-sm font-medium text-gray-700">Chlorine (mg/L)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-gray-900">{zone.chlorine}</span>
                      <Badge variant="outline" className={`text-xs ${
                        getParameterStatus("chlorine", zone.chlorine) === "optimal" ? "bg-green-50 text-green-700" :
                        getParameterStatus("chlorine", zone.chlorine) === "warning" ? "bg-yellow-50 text-yellow-700" :
                        "bg-red-50 text-red-700"
                      }`}>
                        {getParameterStatus("chlorine", zone.chlorine) === "optimal" ? "Normal" : 
                         getParameterStatus("chlorine", zone.chlorine) === "warning" ? "Low" : "Very Low"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-6 pt-4 border-t">
                  <button
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                    onClick={() =>
                      navigate(`/water-quality/recommendation/${zone.id}`, {
                        state: { zone },
                      })
                    }
                  >
                    View Recommendation
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Parameter Reference Guide */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Parameter Reference Guide</CardTitle>
            <CardDescription>Optimal ranges for water quality parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">pH Level</h4>
                <p className="text-sm text-gray-600">Optimal: 6.5 - 7.5</p>
                <p className="text-sm text-gray-600">Warning: 6.0 - 8.0</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">TDS (ppm)</h4>
                <p className="text-sm text-gray-600">Optimal: 0 - 400</p>
                <p className="text-sm text-gray-600">Warning: 400 - 500</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Turbidity (NTU)</h4>
                <p className="text-sm text-gray-600">Optimal: 0 - 3</p>
                <p className="text-sm text-gray-600">Warning: 3 - 5</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Chlorine (mg/L)</h4>
                <p className="text-sm text-gray-600">Optimal: 0.4 - 0.8</p>
                <p className="text-sm text-gray-600">Warning: 0.2 - 1.0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WaterQualityMonitoring;
