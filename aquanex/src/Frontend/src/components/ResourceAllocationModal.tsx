import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ResourceAllocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertId: string;
}

const ResourceAllocationModal = ({ open, onOpenChange, alertId }: ResourceAllocationModalProps) => {
  const { toast } = useToast();
  const [crewSize, setCrewSize] = useState("");
  const [equipment, setEquipment] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    // Mock submission - in real app, would send to backend
    toast({
      title: "Resources Allocated",
      description: `Resources allocated for Alert #${alertId}. TODO: Implement backend integration.`,
    });
    onOpenChange(false);
    // Reset form
    setCrewSize("");
    setEquipment("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allocated Resources - Alert #{alertId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="crew-size">Crew Size</Label>
            <Input
              id="crew-size"
              type="number"
              placeholder="e.g., 3"
              value={crewSize}
              onChange={(e) => setCrewSize(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="equipment">Equipment Type</Label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger>
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leak-detection">Leak Detection Kit</SelectItem>
                <SelectItem value="repair-tools">Repair Tools</SelectItem>
                <SelectItem value="excavator">Excavator</SelectItem>
                <SelectItem value="sensor-replacement">Sensor Replacement Kit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Allocate Resources
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResourceAllocationModal;