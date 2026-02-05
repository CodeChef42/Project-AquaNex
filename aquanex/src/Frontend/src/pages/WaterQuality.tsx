import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Droplet, TrendingUp, TrendingDown } from "lucide-react";

const waterQualityData = [
  {
    zone: "Zone A - North Field",
    ph: 7.2,
    tds: 320,
    turbidity: 2.1,
    chlorine: 0.5,
    status: "optimal",
    lastUpdated: "2 mins ago"
  },
  {
    zone: "Zone B - South Field",
    ph: 6.8,
    tds: 450,
    turbidity: 4.5,
    chlorine: 0.3,
    status: "warning",
    lastUpdated: "5 mins ago"
  },
  {
    zone: "Zone C - East Field",
    ph: 7.5,
    tds: 280,
    turbidity: 1.8,
    chlorine: 0.6,
    status: "optimal",
    lastUpdated: "3 mins ago"
  },
  {
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
  const [selectedZone, setSelectedZone] = useState(null);

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
                {zone.status !== "optimal" && (
                  <div className="mt-6 pt-4 border-t">
                    <button className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                      View Recommendations
                    </button>
                  </div>
                )}
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
