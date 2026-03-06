import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const FitMapToPoints = ({
  points,
  fallbackZoom = 11,
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

interface GlobalMapViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GlobalMapView = ({ open, onOpenChange }: GlobalMapViewProps) => {
  const { workspace } = useAuth();
  const devices = Array.isArray(workspace?.devices) ? workspace.devices : [];
  const layoutPolygon = Array.isArray(workspace?.layout_polygon) ? workspace.layout_polygon : [];

  const geolocatedDevices = devices
    .map((device: any) => ({
      ...device,
      lat: Number(device?.lat),
      lng: Number(device?.lng),
    }))
    .filter(
      (device: any) =>
        Number.isFinite(device.lat) &&
        Number.isFinite(device.lng)
    );

  const mapFocusPoints = useMemo<[number, number][]>(() => {
    const fromLayout = layoutPolygon
      .map((point: any) => [Number(point?.[1]), Number(point?.[0])] as [number, number])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const fromDevices = geolocatedDevices.map((d: any) => [d.lat, d.lng] as [number, number]);
    return [...fromLayout, ...fromDevices];
  }, [geolocatedDevices, layoutPolygon]);

  const pipelineLinePositions = useMemo<[number, number][]>(() => {
    const ordered = geolocatedDevices
      .map((device: any) => {
        const descriptor = `${String(device?.id || "").toLowerCase()} ${String(device?.type || "").toLowerCase()}`;
        const isUpstream = /(^|[^0-9])(0*1|f0*1|p0*1|upstream|inlet)([^0-9]|$)/.test(descriptor);
        const isDownstream = /(^|[^0-9])(0*2|f0*2|p0*2|downstream|outlet)([^0-9]|$)/.test(descriptor);
        const isFlow = String(device?.type || "").toLowerCase().includes("flow");
        const isPressure = String(device?.type || "").toLowerCase().includes("pressure");

        let order: number | null = null;
        if (isFlow && isUpstream) order = 1;
        if (isPressure && isUpstream) order = 2;
        if (isPressure && isDownstream) order = 3;
        if (isFlow && isDownstream) order = 4;
        return { device, order };
      })
      .filter((item: any) => item.order !== null)
      .sort((a: any, b: any) => a.order - b.order)
      .map((item: any) => [item.device.lat, item.device.lng] as [number, number]);

    return ordered;
  }, [geolocatedDevices]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            Map View {workspace?.workspace_name ? `- ${workspace.workspace_name}` : ""}
          </DialogTitle>
        </DialogHeader>
        {geolocatedDevices.length === 0 && layoutPolygon.length < 3 ? (
          <p className="text-sm text-muted-foreground">
            No geolocated devices or layout polygon found for this workspace.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <MapContainer center={DUBAI_CENTER} zoom={11} style={{ height: "560px", width: "100%" }}>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles © Esri"
              />
              <FitMapToPoints points={mapFocusPoints} fallbackZoom={11} maxZoom={16} />
              {layoutPolygon.length > 2 && (
                <Polygon
                  positions={layoutPolygon.map((point: any) => [Number(point?.[1]), Number(point?.[0])])}
                  pathOptions={{ color: "#0ea5e9", weight: 2, fillOpacity: 0.15 }}
                />
              )}
              {pipelineLinePositions.length > 1 && (
                <Polyline positions={pipelineLinePositions} pathOptions={{ color: "#f59e0b", weight: 5, opacity: 0.95 }} />
              )}
              {geolocatedDevices.map((device: any) => (
                <CircleMarker
                  key={device.id}
                  center={[device.lat, device.lng]}
                  radius={7}
                  pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold">{device.id}</p>
                      <p>{device.type}</p>
                      <p>
                        {device.metric}: {String(device.reading)}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GlobalMapView;
