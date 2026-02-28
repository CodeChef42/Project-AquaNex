import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Building2, Users, LayoutGrid, Upload, Cpu, Bell, CheckCircle } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";

interface OnboardingData {
  companyName: string;
  companyType: string;
  location: string;
  logo: File | null;
  teamSize: string;
  inviteEmails: string[];
  modules: string[];
  layoutFile: File | null;
  gatewayId: string;
  thresholds: {
    soilMoisture: [number, number];
    ph: [number, number];
    pressure: [number, number];
  };
  notifications: string[];
}

const STEPS = [
  { id: 1, label: "Organization", icon: Building2 },
  { id: 2, label: "Team",         icon: Users },
  { id: 3, label: "Modules",      icon: LayoutGrid },
  { id: 4, label: "Layout",       icon: Upload },
  { id: 5, label: "Gateway",      icon: Cpu },
  { id: 6, label: "Alerts",       icon: Bell },
  { id: 7, label: "Ready",        icon: CheckCircle },
];

const MODULES = [
  { id: "pipeline", label: "Pipeline Management",  desc: "Monitor pipelines, pressure and flow" },
  { id: "salinity", label: "Soil Salinity",         desc: "Track soil salt levels across zones" },
  { id: "water",    label: "Water Quality",         desc: "Monitor pH, TDS, turbidity, chlorine" },
  { id: "forecast", label: "Demand Forecasting",    desc: "AI-powered water usage predictions" },
  { id: "incident", label: "Incident Analytics",    desc: "Real-time alerts and incident tracking" },
];

const SPACE_TYPES = [
  "Urban Landscape",
  "Public Park",
  "Sports Facility",
  "Roadside Greenery",
  "Residential Complex",
  "Agricultural",
  "Other",
];

const TEAM_SIZES = ["1-5", "6-20", "21-50", "51-100", "100+"];

const INITIAL: OnboardingData = {
  companyName: "",
  companyType: "",
  location: "",
  logo: null,
  teamSize: "",
  inviteEmails: [],
  modules: [],
  layoutFile: null,
  gatewayId: "",
  thresholds: {
    soilMoisture: [20, 80],
    ph: [6, 8],
    pressure: [2, 6],
  },
  notifications: ["in-app"],
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL);
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (fields: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...fields }));

  const toggleModule = (id: string) =>
    update({
      modules: data.modules.includes(id)
        ? data.modules.filter((m) => m !== id)
        : [...data.modules, id],
    });

  const toggleNotif = (type: string) =>
    update({
      notifications: data.notifications.includes(type)
        ? data.notifications.filter((n) => n !== type)
        : [...data.notifications, type],
    });

  const addEmail = () => {
    if (emailInput && !data.inviteEmails.includes(emailInput)) {
      update({ inviteEmails: [...data.inviteEmails, emailInput] });
      setEmailInput("");
    }
  };

  const canProceed = () => {
    if (step === 1) return data.companyName.trim() !== "" && data.companyType !== "";
    if (step === 3) return data.modules.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`${import.meta.env.VITE_API_URL}/api/onboarding/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName: data.companyName,
          companyType: data.companyType,
          location: data.location,
          teamSize: data.teamSize,
          modules: data.modules,
          inviteEmails: data.inviteEmails,
          gatewayId: data.gatewayId,
          thresholds: data.thresholds,
          notifications: data.notifications,
        }),
      });
    } catch (err) {
      console.error('Onboarding save failed:', err);
    } finally {
      setSaving(false);
      navigate('/home');
    }
  };

  const Step1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tell us about your organization</h2>
        <p className="text-muted-foreground mt-1">This helps AquaNex configure your workspace correctly.</p>
      </div>

      <div className="flex items-center gap-5">
        <div
          onClick={() => document.getElementById("logo-upload")?.click()}
          className="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-muted cursor-pointer hover:border-primary transition-colors overflow-hidden"
        >
          {data.logo ? (
            <img src={URL.createObjectURL(data.logo)} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-7 h-7 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">Organization Logo</p>
          <p className="text-xs text-muted-foreground">PNG or JPG, max 2MB</p>
          <button
            onClick={() => document.getElementById("logo-upload")?.click()}
            className="text-xs text-primary hover:underline mt-1"
          >
            Upload logo
          </button>
        </div>
        <input
          id="logo-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => update({ logo: e.target.files?.[0] ?? null })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Organization Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Dubai Municipality Parks Division"
          value={data.companyName}
          onChange={(e) => update({ companyName: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Space Type <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SPACE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => update({ companyType: type })}
              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                data.companyType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Location</label>
        <input
          type="text"
          placeholder="e.g. Dubai, UAE"
          value={data.location}
          onChange={(e) => update({ location: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        />
      </div>
    </div>
  );

  const Step2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Set up your team</h2>
        <p className="text-muted-foreground mt-1">Invite colleagues to collaborate. You can do this later too.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Team Size</label>
        <div className="flex flex-wrap gap-3">
          {TEAM_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => update({ teamSize: size })}
              className={`px-5 py-2 rounded-xl border text-sm font-medium transition-all ${
                data.teamSize === size
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Invite Team Members</label>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@company.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            className="flex-1 px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <button
            onClick={addEmail}
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
        </div>
        {data.inviteEmails.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {data.inviteEmails.map((email) => (
              <span key={email} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm">
                {email}
                <button onClick={() => update({ inviteEmails: data.inviteEmails.filter((e) => e !== email) })}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Press Enter or click Add.</p>
      </div>
    </div>
  );

  const Step3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose your modules</h2>
        <p className="text-muted-foreground mt-1">Select features your team needs. You can change this later.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULES.map((mod) => {
          const selected = data.modules.includes(mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => toggleModule(mod.id)}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{mod.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{mod.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  selected ? "border-primary bg-primary" : "border-border"
                }`}>
                  {selected && <span className="text-white text-[10px]">✓</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const Step4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Upload your irrigation layout</h2>
        <p className="text-muted-foreground mt-1">
          AquaNex extracts coordinates and boundaries to build your irrigation map automatically.
        </p>
      </div>
      <div
        onClick={() => document.getElementById("layout-upload")?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          data.layoutFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        {data.layoutFile ? (
          <div className="space-y-1">
            <p className="font-semibold text-primary">{data.layoutFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(data.layoutFile.size / 1024 / 1024).toFixed(2)} MB — Click to replace
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium text-sm">Drop your layout documents here</p>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DWG, KML supported</p>
          </div>
        )}
        <input
          id="layout-upload"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.kml,.dwg"
          className="hidden"
          onChange={(e) => update({ layoutFile: e.target.files?.[0] ?? null })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 bg-muted/40 rounded-2xl text-xs text-muted-foreground">
        <span>GPS coordinates and boundaries</span>
        <span>Valve and TEE locations</span>
        <span>Controller positions</span>
        <span>Pipeline routes and zone sizes</span>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        No document?{" "}
        <button className="text-primary hover:underline" onClick={() => setStep(5)}>
          Skip and continue
        </button>
      </p>
    </div>
  );

  const Step5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Connect your gateway</h2>
        <p className="text-muted-foreground mt-1">
          Register one gateway device. AquaNex will auto-discover all connected sensors.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Gateway ID</label>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. AQN-GW-UAE-20045"
            value={data.gatewayId}
            onChange={(e) => update({ gatewayId: e.target.value })}
            className="flex-1 px-4 py-3 rounded-xl border border-border bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button className="px-5 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            Scan QR
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Found on the label of your gateway device.</p>
      </div>
      <div className="p-5 bg-muted/40 rounded-2xl space-y-2 text-sm text-muted-foreground">
        {[
          "You enter one Gateway ID",
          "AquaNex pings the gateway via MQTT",
          "Gateway returns a full device manifest",
          "All sensors appear automatically",
          "You assign sensors to zones",
        ].map((line, i) => (
          <p key={i}>{i + 1}. {line}</p>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        No gateway yet?{" "}
        <button className="text-primary hover:underline" onClick={() => setStep(6)}>
          Skip and connect later
        </button>
      </p>
    </div>
  );

  const Step6 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configure alert thresholds</h2>
        <p className="text-muted-foreground mt-1">
          AquaNex notifies you when sensor values go outside these ranges.
        </p>
      </div>
      {[
        { key: "soilMoisture", label: "Soil Moisture",  unit: "%",   min: 0, max: 100 },
        { key: "ph",           label: "pH Level",       unit: "pH",  min: 0, max: 14 },
        { key: "pressure",     label: "Water Pressure", unit: "bar", min: 0, max: 10 },
      ].map(({ key, label, unit, min, max }) => {
        const vals = data.thresholds[key as keyof typeof data.thresholds];
        return (
          <div key={key} className="p-5 rounded-2xl border border-border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-sm text-primary font-medium">
                {vals[0]} – {vals[1]} {unit}
              </span>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Min</label>
                <input
                  type="range" min={min} max={max} value={vals[0]}
                  onChange={(e) => update({ thresholds: { ...data.thresholds, [key]: [Number(e.target.value), vals[1]] } })}
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Max</label>
                <input
                  type="range" min={min} max={max} value={vals[1]}
                  onChange={(e) => update({ thresholds: { ...data.thresholds, [key]: [vals[0], Number(e.target.value)] } })}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="space-y-2">
        <label className="text-sm font-medium">Notification Channels</label>
        <div className="flex gap-3">
          {[
            { id: "in-app", label: "In-App" },
            { id: "email",  label: "Email" },
            { id: "sms",    label: "SMS" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => toggleNotif(id)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                data.notifications.includes(id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const Step7 = () => (
    <div className="text-center space-y-8 py-4">
      <div className="space-y-3">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Your workspace is ready</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          AquaNex has been configured for <strong>{data.companyName || "your organization"}</strong>.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
        {[
          { label: "Organization",  value: data.companyName || "—" },
          { label: "Team Size",     value: data.teamSize || "Not set" },
          { label: "Invites Sent",  value: data.inviteEmails.length ? `${data.inviteEmails.length} member(s)` : "None" },
          { label: "Modules",       value: `${data.modules.length} enabled` },
          { label: "Layout",        value: data.layoutFile ? "Uploaded" : "Not uploaded" },
          { label: "Gateway",       value: data.gatewayId || "Not connected" },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-2xl bg-muted/50 space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium text-sm truncate">{value}</p>
          </div>
        ))}
      </div>
      <button
        onClick={handleFinish}
        disabled={saving}
        className="px-10 py-4 bg-primary text-primary-foreground rounded-2xl text-base font-semibold hover:bg-primary/90 transition-all shadow-lg disabled:opacity-60"
      >
        {saving ? "Saving..." : "Go to Dashboard"}
      </button>
    </div>
  );

  const renderStep = () => {
    const map: Record<number, JSX.Element> = {
      1: <Step1 />,
      2: <Step2 />,
      3: <Step3 />,
      4: <Step4 />,
      5: <Step5 />,
      6: <Step6 />,
      7: <Step7 />,
    };
    return map[step];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">

        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            { label: "Onboarding" },
            { label: STEPS[step - 1].label },
          ]}
        />

        <div className="flex items-center justify-between">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-lg scale-110"
                    : isDone  ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs hidden sm:block ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${isDone ? "bg-green-500" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-8 md:p-10">
          {renderStep()}
        </div>

        {step < 7 && (
          <div className="flex justify-between">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => setStep((s) => Math.min(7, s + 1))}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === 6 ? "Finish Setup" : "Next Step"} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Onboarding;
