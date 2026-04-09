import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for Leaflet's default marker icons not showing up in React
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface PipelinesMapViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: string;
  // Added these so you can pass the actual incident/gateway coordinates!
  lat?: number; 
  lng?: number; 
}

const PipelinesMapView = ({ 
  open, 
  onOpenChange, 
  location, 
  lat = 25.2048, // Default to Dubai center if no coords are provided
  lng = 55.2708 
}: PipelinesMapViewProps) => {

  // Correct URL structure to drop a pin directly on Google Maps
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Location View: {location}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 space-y-4 flex flex-col min-h-0 pt-2">
          {/* Actual Embedded Map using React-Leaflet */}
          <div className="flex-1 rounded-xl border border-border overflow-hidden relative min-h-[400px]">
            {open && ( // Only render the map when the modal is open to prevent Leaflet sizing bugs
              <MapContainer
                center={[lat, lng]}
                zoom={16}
                style={{ height: "100%", width: "100%" }}
              >
                {/* Matches the Satellite style from your other page */}
                <TileLayer 
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
                />
                <Marker position={[lat, lng]}>
                  <Popup>
                    <span className="font-semibold uppercase">{location}</span>
                  </Popup>
                </Marker>
              </MapContainer>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Google Maps
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PipelinesMapView;