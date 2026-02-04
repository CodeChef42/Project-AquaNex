import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Breadcrumbs from "@/components/Breadcrumbs";

const WaterQuality = () => {
  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Water Quality" }]} />

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Water Quality Monitoring</h1>
        <p className="text-muted-foreground">Real-time water quality analysis and management</p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Module Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Module content to be designed. This feature will monitor water quality parameters including pH, TDS, turbidity, and chemical composition across all zones.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaterQuality;
