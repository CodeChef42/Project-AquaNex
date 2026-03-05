import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setResettingPassword(true);
    try {
      await api.post("/auth/change-password/", {
        current_password: currentPassword,
        secret_key: secretKey,
        new_password: newPassword,
      });
      toast({ title: "Success", description: "Password updated successfully." });
      setCurrentPassword("");
      setSecretKey("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      const errors = error?.response?.data;
      const message =
        errors?.current_password?.[0] ||
        errors?.secret_key?.[0] ||
        errors?.new_password?.[0] ||
        errors?.non_field_errors?.[0] ||
        errors?.detail ||
        "Failed to update password.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };


  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Settings" }]} />
      <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
      <p className="text-muted-foreground">Configure your AquaNex platform</p>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="alerts">Alert Thresholds</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  defaultValue={user?.full_name || user?.username || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  defaultValue={user?.email || ""}
                />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Thresholds */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Thresholds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pressure">Pressure Drop Threshold (PSI)</Label>
                <Input id="pressure" type="number" defaultValue={15} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow">Flow Rate Minimum (L/min)</Label>
                <Input id="flow" type="number" defaultValue={600} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salinity">Salinity Alert Level (dS/m)</Label>
                <Input id="salinity" type="number" defaultValue={6.5} />
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
                  <Input id="acoustic" type="number" defaultValue={0.85} step={0.01} />
                  <p className="text-xs text-muted-foreground">Range: 0.0 - 1.0</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variance">Per-Zone Variance Tolerance</Label>
                  <Input id="variance" type="number" defaultValue={15} />
                </div>
                <Button>Save Advanced Settings</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-alerts">Email Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for critical alerts
                  </p>
                </div>
                <Switch id="email-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sms-alerts">SMS Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive SMS for emergency incidents
                  </p>
                </div>
                <Switch id="sms-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="daily-summary">Daily Summary</Label>
                  <p className="text-sm text-muted-foreground">
                    Get a daily summary of platform activity
                  </p>
                </div>
                <Switch id="daily-summary" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security — Reset Password */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret-key">
                    Secret Key{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      (shown once during registration)
                    </span>
                  </Label>
                  <Input
                    id="secret-key"
                    type="password"
                    placeholder="Enter your secret key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={resettingPassword} className="w-full">
                  {resettingPassword ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
