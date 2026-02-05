import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Breadcrumbs from "@/components/Breadcrumbs";
import { TrendingUp, TrendingDown, Droplets, Calendar, AlertTriangle, CheckCircle } from "lucide-react";

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

const weeklyForecast = [
  { day: "Mon", demand: 4200, predicted: 4350, weather: "Sunny" },
  { day: "Tue", demand: 4100, predicted: 4500, weather: "Sunny" },
  { day: "Wed", demand: 3900, predicted: 3800, weather: "Cloudy" },
  { day: "Thu", demand: 4300, predicted: 4200, weather: "Sunny" },
  { day: "Fri", demand: 4500, predicted: 4600, weather: "Hot" },
  { day: "Sat", demand: 4000, predicted: 3900, weather: "Cloudy" },
  { day: "Sun", demand: 3800, predicted: 3700, weather: "Mild" }
];

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

const DemandForecasting = () => {
  const getTrendIcon = (trend) => {
    if (trend === "increase") return <TrendingUp className="w-5 h-5 text-red-500" />;
    if (trend === "decrease") return <TrendingDown className="w-5 h-5 text-green-500" />;
    return <span className="text-blue-500">→</span>;
  };

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

  const getInsightIcon = (type) => {
    if (type === "success") return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (type === "critical") return <AlertTriangle className="w-5 h-5 text-red-500" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Demand Forecasting" }]} />
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2 mt-4">Predictive Water Demand Forecasting</h1>
          <p className="text-gray-600">AI-powered water demand predictions and optimization</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Zone-Level Forecasts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {forecastData.map((zone, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{zone.zone}</CardTitle>
                      <CardDescription className="text-sm text-gray-500 mt-1">
                        7-day forecast analysis
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
                  <div className="w-16 text-sm font-medium text-gray-700">{day.day}</div>
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
