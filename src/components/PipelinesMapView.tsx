import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface PipelinesMapViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: string;
}

const PipelinesMapView = ({ open, onOpenChange, location }: PipelinesMapViewProps) => {
  // Placeholder coordinates - in real app, would geocode the location
  const lat = 25.276987; // Dubai coordinates as example
  const lng = 55.296249;

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Map View - {location}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Placeholder for embedded map */}
          <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">Embedded Map Placeholder</p>
              <p className="text-sm text-muted-foreground">
                In production, this would show an embedded map (e.g., Google Maps, OpenStreetMap)
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <Button asChild>
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