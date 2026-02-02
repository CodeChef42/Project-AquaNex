import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Settings" }]} />

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure your AquaNex platform</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="alerts">Alert Thresholds</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Enter your name" defaultValue="User Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="Enter your email" defaultValue="user@aquanex.com" />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Thresholds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pressure">Pressure Drop Threshold (PSI)</Label>
                <Input id="pressure" type="number" defaultValue="15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow">Flow Rate Minimum (L/min)</Label>
                <Input id="flow" type="number" defaultValue="600" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salinity">Salinity Alert Level (dS/m)</Label>
                <Input id="salinity" type="number" defaultValue="6.5" />
              </div>
              <Button>Save Thresholds</Button>
            </CardContent>
          </Card>

          {!showAdvanced && (
            <Button variant="outline" onClick={() => setShowAdvanced(true)}>
              Show Advanced Settings
            </Button>
          )}

          {showAdvanced && (
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="acoustic">Acoustic Detection Sensitivity</Label>
                  <Input id="acoustic" type="number" defaultValue="0.85" step="0.01" />
                  <p className="text-xs text-muted-foreground">Range: 0.0 - 1.0</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variance">Per-Zone Variance Tolerance (%)</Label>
                  <Input id="variance" type="number" defaultValue="15" />
                </div>
                <Button>Save Advanced Settings</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-alerts">Email Alerts</Label>
                  <p className="text-sm text-muted-foreground">Receive email notifications for critical alerts</p>
                </div>
                <Switch id="email-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sms-alerts">SMS Alerts</Label>
                  <p className="text-sm text-muted-foreground">Receive SMS for emergency incidents</p>
                </div>
                <Switch id="sms-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="daily-summary">Daily Summary</Label>
                  <p className="text-sm text-muted-foreground">Get a daily summary of platform activity</p>
                </div>
                <Switch id="daily-summary" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
