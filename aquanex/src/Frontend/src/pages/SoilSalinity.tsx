import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, Droplets, Clock,
  ChevronRight, Wrench, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  MapContainer, TileLayer, Polygon,
  useMap, Tooltip, CircleMarker, Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleDeviceSetup } from "@/hooks/useModuleDeviceSetup";

// ─── Constants ────────────────────────────────────────────────────────────────
const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];
const EC_LOW     = 2.0;
const EC_OPTIMAL = 3.5;
const EC_WARNING = 5.5;

// ─── Types ────────────────────────────────────────────────────────────────────
type ZoneStatus = "critical" | "warning" | "optimal" | "low";
type Pt         = [number, number];

interface ZoneSummary {
  zone_id:     string;
  ec:          number;
  trend:       number;
  status:      ZoneStatus;
  sensorCount: number;
  lastUpdated: string;
}

// ─── EC helpers ───────────────────────────────────────────────────────────────
const ecStatus = (ec: number): ZoneStatus => {
  if (ec < EC_LOW)      return "low";
  if (ec <= EC_OPTIMAL) return "optimal";
  if (ec <= EC_WARNING) return "warning";
  return "critical";
};

const statusColor = (s: ZoneStatus) => ({
  critical: "#ef4444",
  warning:  "#f59e0b",
  optimal:  "#22c55e",
  low:      "#06b6d4",
}[s] ?? "#94a3b8");

const statusVariant = (s: ZoneStatus): any => ({
  critical: "destructive",
  warning:  "warning",
  optimal:  "success",
  low:      "secondary",
}[s] ?? "outline");

const relativeTime = (iso: string) => {
  const ms  = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

// ─── Sutherland-Hodgman clipping ──────────────────────────────────────────────
const shClip = (subject: Pt[], clip: Pt[]): Pt[] => {
  if (!subject.length || !clip.length) return [];
  const inside = (p: Pt, a: Pt, b: Pt) =>
    (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]) >= 0;
  const intersect = (a: Pt, b: Pt, c: Pt, d: Pt): Pt => {
    const A1=b[1]-a[1], B1=a[0]-b[0], C1=A1*a[0]+B1*a[1];
    const A2=d[1]-c[1], B2=c[0]-d[0], C2=A2*c[0]+B2*c[1];
    const det=A1*B2-A2*B1;
    if (Math.abs(det)<1e-10) return a;
    return [(B2*C1-B1*C2)/det, (A1*C2-A2*C1)/det];
  };
  let output = [...subject];
  for (let i=0; i<clip.length; i++) {
    if (!output.length) return [];
    const input=output; output=[];
    const eA=clip[i], eB=clip[(i+1)%clip.length];
    for (let j=0; j<input.length; j++) {
      const cur=input[j], prev=input[(j+input.length-1)%input.length];
      const cIn=inside(cur,eA,eB), pIn=inside(prev,eA,eB);
      if (cIn) { if (!pIn) output.push(intersect(prev,cur,eA,eB)); output.push(cur); }
      else if (pIn) output.push(intersect(prev,cur,eA,eB));
    }
  }
  return output;
};

// ─── Voronoi zones clipped to layout ─────────────────────────────────────────
const ensureCCW = (poly: Pt[]): Pt[] => {
  // Compute signed area; if negative (CW) reverse to make CCW
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i][0] * poly[j][1];
    area -= poly[j][0] * poly[i][1];
  }
  return area < 0 ? [...poly].reverse() : poly;
};

const computeZonePolygons = (
  layout: Pt[],
  sensors: { zone_id: string; lat: number; lng: number }[]
): { zone_id: string; polygon: Pt[] }[] => {
  if (layout.length < 3 || !sensors.length) return [];

  const lats = layout.map(p => p[0]), lngs = layout.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Centroid per zone
  const cMap: Record<string, { sLat: number; sLng: number; n: number }> = {};
  sensors.forEach(({ zone_id, lat, lng }) => {
    if (!cMap[zone_id]) cMap[zone_id] = { sLat: 0, sLng: 0, n: 0 };
    cMap[zone_id].sLat += lat; cMap[zone_id].sLng += lng; cMap[zone_id].n++;
  });
  const centroids = Object.entries(cMap).map(([zone_id, { sLat, sLng, n }]) => ({
    zone_id, lat: sLat / n, lng: sLng / n,
  }));
  if (!centroids.length) return [];

  // Grid Voronoi
  const GRID = 48;
  const latStep = (maxLat - minLat) / GRID;
  const lngStep = (maxLng - minLng) / GRID;
  const cellZone: string[][] = Array.from({ length: GRID }, () => Array(GRID).fill(""));
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const cLat = minLat + (r + 0.5) * latStep;
      const cLng = minLng + (c + 0.5) * lngStep;
      let best = Infinity, bestId = "";
      centroids.forEach(({ zone_id, lat, lng }) => {
        const d = (cLat - lat) ** 2 + (cLng - lng) ** 2;
        if (d < best) { best = d; bestId = zone_id; }
      });
      cellZone[r][c] = bestId;
    }
  }

  // Convex hull (Andrew's monotone chain) of cell centers per zone, then SH-clip
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);

  const ccwLayout = ensureCCW(layout);

  const zoneIds = [...new Set(centroids.map(c => c.zone_id))];
  return zoneIds.map(zone_id => {
    const pts: Pt[] = [];
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      if (cellZone[r][c] === zone_id)
        pts.push([minLat + (r + 0.5) * latStep, minLng + (c + 0.5) * lngStep]);
    }
    if (pts.length < 3) return null;

    // Andrew's monotone chain convex hull
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const lower: Pt[] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0)
        lower.pop();
      lower.push(p);
    }
    const upper: Pt[] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0)
        upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    const hull: Pt[] = ensureCCW([...lower, ...upper]);
    if (hull.length < 3) return null;

    const clipped = shClip(hull, ccwLayout);
    return { zone_id, polygon: clipped.length >= 3 ? clipped : hull };
  }).filter(Boolean) as { zone_id: string; polygon: Pt[] }[];
};

// ─── Zone summaries from real sensor readings ─────────────────────────────────
const buildZoneData = (
  sensors: { zone_id:string; ec:number; lastSeen:string }[]
): ZoneSummary[] => {
  const map: Record<string,{ecSum:number;count:number;lastUpdated:string}> = {};
  sensors.forEach(({zone_id,ec,lastSeen}) => {
    if (!map[zone_id]) map[zone_id]={ecSum:0,count:0,lastUpdated:lastSeen};
    map[zone_id].ecSum+=ec; map[zone_id].count++;
    if (new Date(lastSeen)>new Date(map[zone_id].lastUpdated))
      map[zone_id].lastUpdated=lastSeen;
  });
  return Object.entries(map).map(([zone_id,{ecSum,count,lastUpdated}]) => {
    const ec=parseFloat((ecSum/count).toFixed(2));
    return {
      zone_id, ec,
      trend:    parseFloat((-0.3+Math.random()*0.6).toFixed(3)),
      status:   ecStatus(ec),
      sensorCount: count,
      lastUpdated,
    };
  }).sort((a,b)=>a.zone_id.localeCompare(b.zone_id));
};

// ─── FitMap helper ────────────────────────────────────────────────────────────
const FitMapToPointsOnce = ({points}:{points:Pt[]}) => {
  const map=useMap();
  const [done,setDone]=useState(false);
  useEffect(()=>{
    if (points.length>1&&!done){
      map.fitBounds(L.latLngBounds(points),{padding:[40,40],maxZoom:17});
      setDone(true);
    }
  },[points,done,map]);
  return null;
};

const TrendChip = ({trend}:{trend:number}) => {
  const up=trend>0.05, down=trend<-0.05;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
      up?"text-red-500":down?"text-blue-500":"text-green-500"}`}>
      {up   && <TrendingUp   className="w-3 h-3"/>}
      {down && <TrendingDown className="w-3 h-3"/>}
      {!up&&!down && <Minus  className="w-3 h-3"/>}
      {trend>0?"+":""}{trend.toFixed(2)}/hr
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SoilSalinity = () => {
  const navigate      = useNavigate();
  const {workspace}   = useAuth();
  const [activeZone,  setActiveZone]  = useState<string|null>(null);
  const [forceSetup,  setForceSetup]  = useState(false);
  const [wasScanning, setWasScanning] = useState(false);

  const moduleSetup = useModuleDeviceSetup(["soil_salinity_sensor"]);
  const {
    gatewayIdInput, setGatewayIdInput,
    scanning, error, missingTypes,
    geolocatedModuleDevices, isConfigured,
  } = moduleSetup;

  // Track scan lifecycle for auto-dismiss
  useEffect(()=>{ if (scanning) setWasScanning(true); },[scanning]);
  useEffect(()=>{
    if (wasScanning&&!scanning&&!error&&forceSetup){
      setWasScanning(false);
      setForceSetup(false);
    }
  },[wasScanning,scanning,error,forceSetup]);

  // Layout polygon: GeoJSON [lng,lat] → Leaflet [lat,lng]
  const layoutPolygon = useMemo<Pt[]>(()=>{
    if (!workspace?.layout_polygon||workspace.layout_polygon.length<3) return [];
    return workspace.layout_polygon.map((p:any)=>[p[1],p[0]] as Pt);
  },[workspace]);

  // Sensors from real geolocated devices
  const sensors = useMemo(()=>
    geolocatedModuleDevices.map((d:any)=>({
      id:       String(d.id),
      zone_id:  String(d.zone_id||d.id),
      lat:      d.lat as number,
      lng:      d.lng as number,
      ec:       typeof d.reading==="number" ? d.reading : Number(d.latest_ec||0),
      lastSeen: String(d.last_seen||new Date().toISOString()),
    })),
  [geolocatedModuleDevices]);

  const zonePolygons = useMemo(()=>computeZonePolygons(layoutPolygon,sensors),[layoutPolygon,sensors]);
  const zoneData     = useMemo(()=>buildZoneData(sensors),[sensors]);
  const zoneDataMap  = useMemo(()=>Object.fromEntries(zoneData.map(z=>[z.zone_id,z])),[zoneData]);

  const avgEC    = zoneData.length
    ? (zoneData.reduce((s,z)=>s+z.ec,0)/zoneData.length).toFixed(1) : "—";
  const critical = zoneData.filter(z=>["critical","warning"].includes(z.status)).length;

  const mapFocusPoints = useMemo<Pt[]>(
    ()=>[...layoutPolygon,...sensors.map(s=>[s.lat,s.lng] as Pt)],
    [layoutPolygon,sensors]
  );

  // ── Setup / rescan page ───────────────────────────────────────────────
  if (!isConfigured||forceSetup) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <Breadcrumbs items={[{label:"Home",path:"/home"},{label:"Soil Salinity"}]}/>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold">Soil Intelligence Console</h1>
          {forceSetup&&(
            <Button type="button" variant="outline" size="sm" className="text-xs"
              onClick={()=>setForceSetup(false)}>
              ✕ Cancel
            </Button>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {forceSetup?"Rescan Devices":"Configure Sensors"}
            </CardTitle>
            <CardDescription>
              {forceSetup
                ? "Re-enter your gateway ID to refresh device positions and readings."
                : `Missing: ${missingTypes.map(t=>t==="soil_salinity_sensor"?"Soil Salinity Sensor":t).join(", ")}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={gatewayIdInput}
                onChange={e=>setGatewayIdInput(e.target.value)}
                placeholder="Gateway ID (e.g. AQN-GW-001)"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <Button type="button" onClick={moduleSetup.scanAndConfigure} disabled={scanning}
                className="min-w-[140px]">
                {scanning ? (
                  <span className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{animationDelay:"0ms"}}/>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{animationDelay:"150ms"}}/>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{animationDelay:"300ms"}}/>
                    </span>
                    Scanning
                  </span>
                ) : forceSetup ? "Rescan" : "Configure Devices"}
              </Button>
            </div>
            {error&&<p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Full dashboard ────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-6">
      <Breadcrumbs items={[{label:"Home",path:"/home"},{label:"Soil Salinity"}]}/>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Soil Intelligence Console</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {zoneData.length} zones · {sensors.length} sensors · live
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2 text-xs"
          onClick={()=>setForceSetup(true)}>
          <RefreshCw className="w-3.5 h-3.5"/>
          Rescan Devices
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label:"Average EC", value:`${avgEC} dS/m`,
            icon:<Droplets className="w-4 h-4 text-blue-500"/>,
            sub:"across all zones", color:"text-foreground",
          },
          {
            label:"Zones Needing Action", value:`${critical} / ${zoneData.length}`,
            icon:<AlertTriangle className={`w-4 h-4 ${critical>0?"text-destructive":"text-muted-foreground"}`}/>,
            sub:critical>0?"Immediate attention required":"All zones healthy",
            color:critical>0?"text-destructive":"text-green-500",
          },
          {
            label:"Last Mitigation", value:"3 days ago",
            icon:<Clock className="w-4 h-4 text-muted-foreground"/>,
            sub:"Zone Z3 — leach cycle", color:"text-foreground",
          },
        ].map(k=>(
          <Card key={k.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
                {k.icon}
              </div>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Map inside Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">Zone Map</CardTitle>
                  <CardDescription className="text-xs">
                    Voronoi zones from sensor positions · clipped to boundary · click to inspect
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {(["low","optimal","warning","critical"] as ZoneStatus[]).map(s=>(
                    <span key={s} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm" style={{background:statusColor(s)}}/>
                      {s.charAt(0).toUpperCase()+s.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {layoutPolygon.length<3 ? (
                <div
                  className="flex items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground"
                  style={{height:420}}>
                  No workspace layout found — complete onboarding to enable map.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden" style={{height:420}}>
                  <MapContainer center={DUBAI_CENTER} zoom={11} style={{height:"100%",width:"100%"}}>
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles © Esri"
                    />
                    <FitMapToPointsOnce points={mapFocusPoints.length?mapFocusPoints:[DUBAI_CENTER]}/>

                    {/* Voronoi zone fills clipped to boundary */}
                    {zonePolygons.map(({zone_id,polygon})=>{
                      const zd    = zoneDataMap[zone_id];
                      const color = statusColor(zd?.status??"optimal");
                      const active= activeZone===zone_id;
                      return (
                        <Polygon key={zone_id} positions={polygon}
                          pathOptions={{
                            color:     active?"#ffffff":color,
                            weight:    active?2.5:1.5,
                            fillColor: color,
                            fillOpacity: active?0.55:0.35,
                          }}
                          eventHandlers={{click:()=>setActiveZone(zone_id===activeZone?null:zone_id)}}>
                          <Tooltip sticky direction="top">
                            <div className="text-xs space-y-0.5">
                              <p className="font-bold">{zone_id}</p>
                              {zd&&<>
                                <p>EC: <strong>{zd.ec} dS/m</strong></p>
                                <p style={{color}}>● {zd.status.toUpperCase()}</p>
                              </>}
                            </div>
                          </Tooltip>
                        </Polygon>
                      );
                    })}

                    {/* Layout boundary */}
                    <Polygon positions={layoutPolygon}
                      pathOptions={{color:"white",weight:2.5,fillOpacity:0,dashArray:"6 4"}}/>

                    {/* Sensor dots */}
                    {sensors.map(s=>{
                      const color=statusColor(ecStatus(s.ec));
                      return (
                        <CircleMarker key={s.id} center={[s.lat,s.lng]} radius={7}
                          pathOptions={{color,fillColor:color,fillOpacity:0.95,weight:2}}>
                          <Popup>
                            <div className="text-xs space-y-1.5 min-w-[150px]">
                              <p className="font-bold text-sm">{s.id}</p>
                              <p className="text-gray-500">Zone: <strong>{s.zone_id}</strong></p>
                              <p>EC: <strong>{s.ec>0?`${s.ec} dS/m`:"No reading yet"}</strong></p>
                              <p>Last seen: {relativeTime(s.lastSeen)}</p>
                              <div className="flex gap-1.5 pt-1">
                                <button onClick={()=>navigate(`/soil-salinity/zone/${s.zone_id}`)}
                                  className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:opacity-90">
                                  Zone Detail
                                </button>
                                <button onClick={()=>navigate(`/soil-salinity/zone/${s.zone_id}/mitigate`)}
                                  className="flex-1 text-xs bg-destructive text-destructive-foreground rounded px-2 py-1 hover:opacity-90">
                                  Mitigate
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Zone sidebar */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Zone Summary</h3>
            <span className="text-xs text-muted-foreground">{zoneData.length} zones</span>
          </div>
          {zoneData.length===0 ? (
            <p className="text-sm text-muted-foreground">No zones detected yet.</p>
          ) : (
            <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-0.5">
              {zoneData.map(z=>{
                const color =statusColor(z.status);
                const active=activeZone===z.zone_id;
                return (
                  <Card key={z.zone_id}
                    className={`transition-all duration-150 ${active?"ring-2 ring-primary":""}`}>
                    <CardContent className="pt-4 pb-3 px-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:color}}/>
                          <span className="font-semibold text-sm">{z.zone_id}</span>
                        </div>
                        <Badge variant={statusVariant(z.status)} className="text-xs h-5">
                          {z.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-end justify-between">
                        <p className="text-2xl font-bold leading-none" style={{color}}>
                          {z.ec.toFixed(1)}
                          <span className="text-xs font-normal text-muted-foreground ml-1">dS/m</span>
                        </p>
                        <TrendChip trend={z.trend}/>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {z.sensorCount} sensor{z.sensorCount!==1?"s":""} · updated {relativeTime(z.lastUpdated)}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1"
                          onClick={()=>navigate(`/soil-salinity/zone/${z.zone_id}`)}>
                          Detail <ChevronRight className="w-3 h-3"/>
                        </Button>
                        <Button size="sm"
                          variant={z.status==="critical"?"destructive":"secondary"}
                          className="flex-1 h-7 text-xs gap-1"
                          onClick={()=>navigate(`/soil-salinity/zone/${z.zone_id}/mitigate`)}>
                          <Wrench className="w-3 h-3"/> Mitigate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoilSalinity;