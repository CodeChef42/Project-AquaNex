import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";

const historyData = [
  { 
    date: "2024-11-10", 
    location: "Zone 3, Pipe 749-B", 
    type: "Pipeline Break",
    status: "Resolved",
    duration: "8h 15m",
    cost: "AED 156k",
    details: "Emergency pipe replacement completed. Material shortage caused 4h delay. Final inspection passed."
  },
  { 
    date: "2024-11-08", 
    location: "Zone 5, Irrigation Line", 
    type: "Sensor Malfunction",
    status: "Resolved",
    duration: "2h 45m",
    cost: "AED 8k",
    details: "Sensor S-802-A replaced. Calibration completed. System restored to normal operation."
  },
  { 
    date: "2024-11-05", 
    location: "Zone 2, Pipe 691-C", 
    type: "Pipeline Leak",
    status: "Resolved",
    duration: "6h 30m",
    cost: "AED 89k",
    details: "Minor leak sealed. Pressure test successful. No further action required."
  },
];

const HistoryLog = () => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "History Log" }]} />

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">History Log</h1>
        <p className="text-muted-foreground">Complete record of resolved incidents and maintenance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyData.map((item, idx) => (
                <>
                  <TableRow 
                    key={idx}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                  >
                    <TableCell className="font-medium">{item.date}</TableCell>
                    <TableCell>{item.location}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>
                      <Badge variant="success">{item.status}</Badge>
                    </TableCell>
                    <TableCell>{item.duration}</TableCell>
                    <TableCell className="font-semibold text-primary">{item.cost}</TableCell>
                    <TableCell>
                      {expandedRow === idx ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedRow === idx && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="p-4 space-y-3">
                          <h4 className="font-semibold">Incident Report</h4>
                          <p className="text-sm text-muted-foreground">{item.details}</p>
                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Timeline</p>
                              <p className="text-sm font-medium">{item.duration}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Final Cost</p>
                              <p className="text-sm font-medium">{item.cost}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Crew</p>
                              <p className="text-sm font-medium">Team Alpha</p>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryLog;
