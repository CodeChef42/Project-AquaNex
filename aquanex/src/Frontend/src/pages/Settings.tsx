import { useState, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
} from "react-leaflet";
import {
  MapDrawingHandler,
  FitMapToPoints,
  vertexIcon,
  calculateArea,
  formatArea,
  isSelfIntersectingPolygon,
  DUBAI_CENTER,
} from "@/components/map-utils"; // adjust if path differs

// ── inline types ────────────────────────────────────────────────────────────
type CrsMode = "auto" | "utm39n" | "utm40n" | "uae_grid";

type ExtractedPoint = {
  id: string;
  lat: number;
  lng: number;
  enabled: boolean;
};

const supportedLayoutExtensions = ["pdf", "jpg", "jpeg", "png", "kml", "dwg"];

const getWorkspaceLayout = (workspace: any) => {
  const polygon: [number, number][] =
    Array.isArray(workspace?.layout_polygon) && workspace.layout_polygon.length >= 3
      ? workspace.layout_polygon
      : Array.isArray(workspace?.layout?.polygon) && workspace.layout.polygon.length >= 3
      ? workspace.layout.polygon
      : [];
  const areaM2 =
    typeof workspace?.layout_area_m2 === "number"
      ? workspace.layout_area_m2
      : typeof workspace?.layout?.area_m2 === "number"
      ? workspace.layout.area_m2
      : 0;
  const notes =
    typeof workspace?.layout_notes === "string"
      ? workspace.layout_notes
      : typeof workspace?.layout?.notes === "string"
      ? workspace.layout.notes
      : "";

  return { polygon, areaM2, notes };
};

// ── main component ──────────────────────────────────────────────────────────
const Settings = () => {
  const { user, workspace, updateWorkspaceLayout } = useAuth();
  const { toast } = useToast();

  // ── password state ──────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword]     = useState("");
  const [secretKey, setSecretKey]                 = useState("");
  const [newPassword, setNewPassword]             = useState("");
  const [confirmPassword, setConfirmPassword]     = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // ── layout state ────────────────────────────────────────────────────────
  const [mapMode, setMapMode]                     = useState<"draw" | "edit" | "idle">("idle");
  const [draftPoints, setDraftPoints]             = useState<[number, number][]>([]);
  const [manualPolygon, setManualPolygon]         = useState<[number, number][]>([]);
  const [manualCoordsInput, setManualCoordsInput] = useState("");
  const [manualCoordsError, setManualCoordsError] = useState("");
  const [crsMode, setCrsMode]                     = useState<CrsMode>("auto");
  const [extractedPoints, setExtractedPoints]     = useState<ExtractedPoint[]>([]);
  const [extractedPolygon, setExtractedPolygon]   = useState<[number, number][]>([]);
  const [layoutTaskId, setLayoutTaskId]           = useState("");
  const [layoutTaskState, setLayoutTaskState]     = useState<"idle" | "pending" | "ready" | "failed">("idle");
  const [layoutTaskMessage, setLayoutTaskMessage] = useState("");
  const [uploadingLayout, setUploadingLayout]     = useState(false);
  const [layoutConfirmed, setLayoutConfirmed]     = useState(false);
  const [savingLayout, setSavingLayout]           = useState(false);
  const [layoutFile, setLayoutFile]               = useState<File | null>(null);
  const [layoutNotes, setLayoutNotes]             = useState("");
  const [editingLayout, setEditingLayout] = useState(false);

  // seed from workspace
useEffect(() => {
  const { polygon, notes } = getWorkspaceLayout(workspace);
  setManualPolygon(polygon);
  setDraftPoints(polygon.map(([lng, lat]) => [lat, lng]));
  setLayoutNotes(notes);
  setLayoutConfirmed(polygon.length >= 3);
  setExtractedPoints([]);
  setExtractedPolygon([]);
  setLayoutTaskId("");
  setLayoutTaskState("idle");
  setLayoutTaskMessage("");
  setLayoutFile(null);
}, [workspace]);

  // ── derived layout values ───────────────────────────────────────────────
  const enabledExtracted = extractedPoints.filter((p) => p.enabled);
  const extractedPolygonDerived: [number, number][] =
    enabledExtracted.length >= 3
      ? enabledExtracted.map((p) => [p.lng, p.lat])
      : extractedPolygon;

  const finalLayoutPolygon: [number, number][] =
    extractedPolygonDerived.length >= 3 ? extractedPolygonDerived : manualPolygon;

  const finalLayoutSource =
    extractedPolygonDerived.length >= 3 ? "document_refined" : "manual_draw";

  const finalLayoutArea =
    finalLayoutPolygon.length >= 3 ? calculateArea(finalLayoutPolygon) : 0;

  const finalLayoutLatLng: [number, number][] = finalLayoutPolygon.map(
    ([lng, lat]) => [lat, lng]
  );

  // ── layout handlers ─────────────────────────────────────────────────────
  const handleSyncDraft = (points: [number, number][]) => {
    const lngLatPoints = points.map((p) => [p[1], p[0]] as [number, number]);
    setManualPolygon(lngLatPoints);
  };

  const applyManualCoordinates = () => {
    setManualCoordsError("");
    const lines = manualCoordsInput.trim().split("\n").filter(Boolean);
    const parsed: [number, number][] = [];
    for (const line of lines) {
      const parts = line.split(",").map((s) => parseFloat(s.trim()));
      if (parts.length < 2 || parts.some(isNaN)) {
        setManualCoordsError(`Invalid line: "${line}". Use format: lng, lat`);
        return;
      }
      parsed.push([parts[0], parts[1]]);
    }
    if (parsed.length < 3) {
      setManualCoordsError("Need at least 3 coordinate pairs.");
      return;
    }
    setManualPolygon(parsed);
    setDraftPoints(parsed.map(([lng, lat]) => [lat, lng]));
    setLayoutConfirmed(false);
    toast({ title: "Coordinates applied", description: `${parsed.length} points loaded onto map.` });
  };

  const handleLayoutUpload = async () => {
    if (!layoutFile) return;
    setUploadingLayout(true);
    setLayoutTaskState("pending");
    setLayoutTaskMessage("");
    try {
      const formData = new FormData();
      formData.append("file", layoutFile);
      formData.append("crs_mode", crsMode);
      const res = await api.post("/workspace/layout/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const taskId = res.data?.task_id;
      setLayoutTaskId(taskId ?? "");
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 30) {
          clearInterval(poll);
          setLayoutTaskState("failed");
          setLayoutTaskMessage("Processing timed out.");
          setUploadingLayout(false);
          return;
        }
        try {
          const status = await api.get(`/workspace/layout/task/${taskId}/`);
          const state = status.data?.state;
          setLayoutTaskMessage(status.data?.message ?? "");
          if (state === "SUCCESS") {
            clearInterval(poll);
            setLayoutTaskState("ready");
            setUploadingLayout(false);
            const points: ExtractedPoint[] = (status.data?.points ?? []).map(
              (p: any, i: number) => ({ id: `ep-${i}`, lat: p.lat, lng: p.lng, enabled: true })
            );
            setExtractedPoints(points);
            if (status.data?.polygon) setExtractedPolygon(status.data.polygon);
            toast({ title: "Extraction complete", description: `${points.length} reference points extracted.` });
          } else if (state === "FAILURE") {
            clearInterval(poll);
            setLayoutTaskState("failed");
            setUploadingLayout(false);
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (err: any) {
      setLayoutTaskState("failed");
      setLayoutTaskMessage(err?.response?.data?.error ?? "Upload failed.");
      setUploadingLayout(false);
    }
  };

  const handleConfirmLayout = async (): Promise<boolean> => {
    if (finalLayoutPolygon.length < 3) return false;
    setSavingLayout(true);
    try {
      await api.patch("/workspace/layout/", {
        polygon: finalLayoutPolygon,
        area_m2: finalLayoutArea,
        notes:   layoutNotes,
      });
      updateWorkspaceLayout({
        polygon: finalLayoutPolygon,
        area_m2: finalLayoutArea,
        notes: layoutNotes,
      });
      setLayoutConfirmed(true);
      toast({ title: "Layout saved", description: "Workspace layout updated across all modules." });
      return true;
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.response?.data?.error ?? "Could not save layout.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSavingLayout(false);
    }
  };

  const clearManualPolygon = () => { setManualPolygon([]); setDraftPoints([]); setLayoutConfirmed(false); };
  const clearExtractedPolygon = () => { setExtractedPolygon([]); setExtractedPoints([]); setLayoutConfirmed(false); };
  const clearLayoutSelection = () => { clearManualPolygon(); clearExtractedPolygon(); setLayoutFile(null); setLayoutConfirmed(false); setMapMode("idle"); };

  // ── password handler ────────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" }); return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" }); return;
    }
    setResettingPassword(true);
    try {
      await api.post("/auth/change-password/", {
        current_password: currentPassword,
        secret_key:       secretKey,
        new_password:     newPassword,
      });
      toast({ title: "Success", description: "Password updated successfully." });
      setCurrentPassword(""); setSecretKey(""); setNewPassword(""); setConfirmPassword("");
    } catch (error: any) {
      const errors = error?.response?.data;
      const pick = (value: any) => Array.isArray(value) ? value[0] : value;
      const message =
        pick(errors?.current_password) || pick(errors?.secret_key) ||
        pick(errors?.new_password)     || pick(errors?.non_field_errors) ||
        errors?.detail || "Failed to update password.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally { setResettingPassword(false); }
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", path: "/home" }, { label: "Settings" }]} />
      <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
      <p className="text-muted-foreground">Configure your AquaNex platform</p>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* ── General ────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Enter your name" defaultValue={user?.full_name || user?.username || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="Enter your email" defaultValue={user?.email || ""} />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Layout ─────────────────────────────────────────────────── */}
        {/* ── Layout ─────────────────────────────────────────────────── */}
        {/* ── Layout ─────────────────────────────────────────────────── */}
        <TabsContent value="layout" className="space-y-6">
          {!editingLayout ? (
            <>
              <div>
                <h2 className="text-xl font-bold">Workspace Layout</h2>
                <p className="text-muted-foreground mt-1">
                  View or manage your current saved irrigation layout.
                </p>
              </div>
          
              {finalLayoutPolygon.length >= 3 ? (
                <div className="space-y-4 rounded-2xl border border-border p-4 bg-muted/20">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Current Layout</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-medium border border-emerald-200">
                      ✅ Saved
                    </span>
                  </div>
              
                  <div className="rounded-xl border border-border overflow-hidden">
                    <MapContainer
                      key="view-map"
                      center={DUBAI_CENTER}
                      zoom={12}
                      style={{ height: "300px", width: "100%" }}
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="Tiles &copy; Esri"
                      />
                      <FitMapToPoints points={finalLayoutLatLng} fallbackZoom={12} maxZoom={16} />
                      <Polygon
                        positions={finalLayoutPolygon.map(([lng, lat]) => [lat, lng])}
                        pathOptions={{ color: "#0ea5e9", weight: 3, fillOpacity: 0.25 }}
                      />
                    </MapContainer>
                  </div>
              
                  <p className="text-xs text-muted-foreground">
                    Area: {formatArea(finalLayoutArea)}
                    {layoutNotes ? ` · ${layoutNotes}` : ""}
                  </p>
              
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => {
                      const { polygon, notes } = getWorkspaceLayout(workspace);
                      setManualPolygon(polygon);
                      setDraftPoints(polygon.map(([lng, lat]) => [lat, lng]));
                      setLayoutNotes(notes);
                      setEditingLayout(true);
                      setMapMode("idle");
                    }}>
                      Edit Layout
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={async () => {
                        try {
                          await api.patch("/workspace/layout/", { polygon: [], area_m2: 0, notes: "" });
                          updateWorkspaceLayout({ polygon: [], area_m2: 0, notes: "" });
                          clearLayoutSelection();
                          toast({ title: "Layout cleared" });
                        } catch {
                          toast({
                            title: "Error",
                            description: "Could not clear layout.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Clear Layout
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">No layout saved yet.</p>
                  <Button onClick={() => {
                    const { polygon, notes } = getWorkspaceLayout(workspace);
                    setManualPolygon(polygon);
                    setDraftPoints(polygon.map(([lng, lat]) => [lat, lng]));
                    setLayoutNotes(notes);
                    setEditingLayout(true);
                    setMapMode("idle");
                  }}>Set Layout</Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Edit Layout</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Adjust existing points or upload a new irrigation drawing.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditingLayout(false);
                    setMapMode("idle");
                    const { polygon, notes } = getWorkspaceLayout(workspace);
                    setManualPolygon(polygon);
                    setDraftPoints(polygon.map(([lng, lat]) => [lat, lng]));
                    setLayoutNotes(notes);
                    setExtractedPolygon([]);
                    setExtractedPoints([]);
                    setLayoutConfirmed(polygon.length >= 3);
                  }}
                >
                  Cancel
                </Button>
              </div>
        
              {/* === MANUAL MAP EDITING (EDIT & CLEAR ONLY) === */}
              <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMapMode("draw")}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  mapMode === "draw" ? "bg-primary text-white border-primary" : "bg-white border-border hover:bg-muted"
                }`}
              >
                Draw
              </button>
              <button
                type="button"
                onClick={() => setMapMode("edit")}
                disabled={draftPoints.length === 0}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  mapMode === "edit" ? "bg-primary text-white border-primary" : "bg-white border-border hover:bg-muted"
                }`}
              >
                Edit Points
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftPoints([]);
                  handleSyncDraft([]);
                  setMapMode("idle");
                  setLayoutConfirmed(false);
                }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-white border border-border hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
              >
                Clear
              </button>
              </div>
                  
              {/* Main map */}
              <div className={`rounded-2xl border-2 overflow-hidden shadow-lg bg-white transition-colors ${mapMode !== "idle" ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                <MapContainer
                  key="edit-map"
                  center={DUBAI_CENTER}
                  zoom={12}
                  style={{ height: "400px", width: "100%", cursor: mapMode === "edit" ? "grab" : "default" }}
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                  <MapDrawingHandler
                    mapMode={mapMode}
                    draftPoints={draftPoints}
                    onInvalidDraw={(message) =>
                      toast({ title: "Invalid layout", description: message, variant: "destructive" })
                    }
                    onAddPoint={(latlng) => {
                      const pt: [number, number] = [latlng.lat, latlng.lng];
                      const newPoints = [...draftPoints, pt];
                      setDraftPoints(newPoints);
                      handleSyncDraft(newPoints);
                      setLayoutConfirmed(false);
                    }}
                    onFinishDrawing={() => {
                      setMapMode("idle");
                      handleSyncDraft(draftPoints);
                    }}
                  />
                  {draftPoints.length > 0 && (
                    <Polyline
                      positions={draftPoints}
                      pathOptions={{ color: "#0ea5e9", weight: 2 }}
                    />
                  )}
                  {draftPoints.map((pt, i) => (
                    <Marker
                      key={i}
                      position={pt}
                      icon={vertexIcon}
                      draggable={mapMode === "edit"}
                      eventHandlers={{
                        dragend: (e) => {
                          const { lat, lng } = e.target.getLatLng();
                          const newPoints = [...draftPoints];
                          newPoints[i] = [lat, lng];
                          if (isSelfIntersectingPolygon(newPoints)) {
                            e.target.setLatLng(draftPoints[i]);
                            toast({
                              title: "Invalid layout",
                              description: "Polygon cannot cross over itself.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setDraftPoints(newPoints);
                          handleSyncDraft(newPoints);
                          setLayoutConfirmed(false);
                        },
                      }}
                    />
                  ))}
                  {mapMode === "idle" && finalLayoutPolygon.length > 2 && (
                    <Polygon
                      positions={finalLayoutPolygon.map(([lng, lat]) => [lat, lng])}
                      pathOptions={{ color: "blue", weight: 3, fillOpacity: 0.2 }}
                    />
                  )}
                  <FitMapToPoints points={draftPoints.length > 2 ? draftPoints : finalLayoutLatLng} fallbackZoom={12} maxZoom={16} />
                </MapContainer>
              </div>

              {/* === MANUAL COORDINATES TEXTAREA === */}
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold">Manual Coordinates</p>
                <p className="text-xs text-muted-foreground">
                  Paste coordinates as pairs (one line each), e.g. `55.2708, 25.2048`.
                </p>
                <textarea
                  value={manualCoordsInput}
                  onChange={(e) => setManualCoordsInput(e.target.value)}
                  placeholder={"55.2708, 25.2048\n55.2720, 25.2048\n55.2720, 25.2060\n55.2708, 25.2060"}
                  className="w-full h-28 px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {manualCoordsError && (
                  <p className="text-xs text-destructive">{manualCoordsError}</p>
                )}
                <button
                  type="button"
                  onClick={applyManualCoordinates}
                  className="w-full py-2.5 px-6 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors"
                >
                  Apply Coordinates
                </button>
              </div>

              {/* === IRRIGATION DRAWING UPLOAD === */}
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold">Irrigation Drawing Upload</p>
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, JPG, PNG, DWG, KML.
                </p>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Coordinate System
                  </label>
                  <select
                    value={crsMode}
                    onChange={(e) => setCrsMode(e.target.value as CrsMode)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="auto">Auto detect</option>
                    <option value="utm39n">UTM Zone 39N (EPSG:32639)</option>
                    <option value="utm40n">UTM Zone 40N (EPSG:32640)</option>
                    <option value="uae_grid">UAE Grid (EPSG:3997)</option>
                  </select>
                </div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.kml,.dwg"
                  className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary hover:bg-muted/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/90 file:text-white file:font-medium hover:file:bg-primary"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return setLayoutFile(null);
                    
                    const extension = file.name.split(".").pop()?.toLowerCase() || "";
                    if (!supportedLayoutExtensions.includes(extension)) {
                      toast({ title: "Unsupported format", description: "Upload PDF, JPG, PNG, DWG, or KML.", variant: "destructive" });
                      e.target.value = "";
                      return;
                    }
                    setLayoutFile(file);
                  }}
                />

                {layoutFile && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                    <p className="font-medium text-emerald-800">{layoutFile.name}</p>
                    <p className="text-xs text-emerald-700">{(layoutFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}

                {extractedPoints.length > 0 && (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold">
                      Extracted Points ({extractedPoints.filter((p) => p.enabled).length}/{extractedPoints.length} enabled)
                    </p>
                    <div className="max-h-40 overflow-auto space-y-1">
                      {extractedPoints.map((point, index) => (
                        <label key={point.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={point.enabled}
                            onChange={(e) => {
                              setLayoutConfirmed(false);
                              setExtractedPoints((prev) =>
                                prev.map((p) => (p.id === point.id ? { ...p, enabled: e.target.checked } : p))
                              );
                            }}
                          />
                          <span className="font-medium">P{index + 1}</span>
                          <span className="font-mono text-[11px]">
                            {point.lng.toFixed(6)}, {point.lat.toFixed(6)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleLayoutUpload}
                  disabled={!layoutFile || uploadingLayout}
                >
                  {uploadingLayout ? "Processing Document..." : "Upload & Process Layout"}
                </Button>

                {(layoutTaskId || layoutTaskState !== "idle") && (
                  <div className={`rounded-xl border p-3 text-xs ${
                    layoutTaskState === "ready" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                    layoutTaskState === "failed" ? "bg-rose-50 border-rose-200 text-rose-800" :
                    "bg-amber-50 border-amber-200 text-amber-800"
                  }`}>
                    <p className="font-semibold">
                      {layoutTaskState === "ready" ? "Extraction completed" :
                       layoutTaskState === "failed" ? "Extraction failed" : "Extraction in progress"}
                    </p>
                    {layoutTaskMessage && <p>{layoutTaskMessage}</p>}
                  </div>
                )}
              </div>

              {/* === NOTES AND SAVE === */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 space-y-3">
                <p className="text-sm font-medium">
                  {finalLayoutPolygon.length
                    ? `Mapped area: ${formatArea(finalLayoutArea)}`
                    : "Upload a document or map an area to estimate size."}
                </p>
                <input
                  type="text"
                  placeholder="Layout notes (optional)..."
                  value={layoutNotes}
                  onChange={(e) => setLayoutNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <Button
                className="w-full py-6 text-base"
                size="lg"
                onClick={async () => {
                  const didSave = await handleConfirmLayout();
                  if (didSave) setEditingLayout(false);
                }}
                disabled={savingLayout || finalLayoutPolygon.length < 3}
              >
                {savingLayout ? "Saving..." : "Save Layout Settings"}
              </Button>
            </>
          )}
        </TabsContent>
        
        {/* ── Notifications ──────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
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

        {/* ── Security ───────────────────────────────────────────────── */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Reset Password</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" placeholder="Enter current password"
                    value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret-key">
                    Secret Key{" "}
                    <span className="text-xs text-muted-foreground font-normal">(shown once during registration)</span>
                  </Label>
                  <Input id="secret-key" type="password" placeholder="Enter your secret key"
                    value={secretKey} onChange={(e) => setSecretKey(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" placeholder="Min. 8 characters"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" placeholder="Re-enter new password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
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
