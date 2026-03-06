import { MapContainer, TileLayer, Polygon, Circle, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { useMemo, useState } from "react";

interface IDWPoint {
  lat: number;
  lng: number;
  ec_estimate: number;
}

interface Zone {
  id: string;
  name: string;
  boundary: any; // GeoJSON
  latest_ec: number | null;
  ec_threshold: number;
}

interface SoilMapProps {
  zones: Zone[];
  heatmapData?: IDWPoint[];
  selectedZoneId?: string;
  onZoneClick?: (zoneId: string) => void;
}

const getEcColor = (ec: number, threshold: number) => {
  if (ec >= threshold * 1.5) return "#ef4444"; // destructive/red
  if (ec >= threshold) return "#f59e0b"; // warning/amber
  return "#22c55e"; // success/green
};

const SoilMap = ({ zones, heatmapData, selectedZoneId, onZoneClick }: SoilMapProps) => {
  // Default center (can be calculated from zones)
  const center: [number, number] = [25.276987, 55.296249];

  const zonePolygons = useMemo(() => {
    return zones.map(zone => {
      // Assuming boundary is a GeoJSON Polygon: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
      // Leaflet expects [[lat, lng], ...]
      const coordinates = zone.boundary?.coordinates?.[0]?.map((coord: number[]) => [coord[1], coord[0]]) || [];
      return {
        id: zone.id,
        name: zone.name,
        positions: coordinates,
        color: getEcColor(zone.latest_ec || 0, zone.ec_threshold),
        ec: zone.latest_ec
      };
    });
  }, [zones]);

  return (
    <MapContainer 
      center={center} 
      zoom={13} 
      className="w-full h-full rounded-lg z-0"
    >
      
      {zonePolygons.map(p => (
        <Polygon
          key={p.id}
          positions={p.positions as any}
          pathOptions={{
            fillColor: p.color,
            fillOpacity: selectedZoneId === p.id ? 0.6 : 0.3,
            color: p.color,
            weight: selectedZoneId === p.id ? 3 : 1
          }}
          eventHandlers={{
            click: () => onZoneClick?.(p.id)
          }}
        >
          <Popup>
            <div className="p-1">
              <p className="font-bold">{p.name}</p>
              <p className="text-xs">Current EC: {p.ec?.toFixed(2) || "N/A"} dS/m</p>
            </div>
          </Popup>
        </Polygon>
      ))}

      {/* Heatmap implementation using circles from IDW points */}
      {heatmapData?.map((point, idx) => (
        <Circle
          key={`idw-${idx}`}
          center={[point.lat, point.lng]}
          radius={20} // adjust based on grid resolution
          pathOptions={{
            fillColor: getEcColor(point.ec_estimate, 4.0), // Using 4.0 as global threshold for heatmap colors
            fillOpacity: 0.4,
            stroke: false
          }}
        />
      ))}
      
      {/* Map Type Toggle Control */}
      <LayersControl position="topright">
        <LayersControl.BaseLayer
          name="Satellite"
          checked={true}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer
          name="Street Map"
          checked={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        </LayersControl.BaseLayer>
      </LayersControl>
    </MapContainer>
  );
};

export default SoilMap;