import { Search, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GlobalHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  
  // 🛡️ TWO-STEP LOGOUT STATE
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleGlobalSearch = async () => {
    const value = query.trim().replace(/^#/, "");
    if (!value) return;
    
    setSearching(true);
    try {
      const res = await api.get("/incidents/");
      const payload = res.data;
      const incidents = Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : []);
      
      const normalized = value.toLowerCase();
      const exactMatch = incidents.find((inc: any) => String(inc?.id || "").toLowerCase() === normalized);
      const partialMatch = incidents.find((inc: any) => String(inc?.id || "").toLowerCase().includes(normalized));
      
      const matchedId = String(exactMatch?.id || partialMatch?.id || value);
      navigate(`/pipeline/alerts?alertId=${encodeURIComponent(matchedId)}`);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate("/");
  };

  return (
    <>
      <header
        className="h-20 border-b border-cyan-200/60 shrink-0 backdrop-blur-md sticky top-0 z-50 w-full"
        style={{ background: "rgba(255,255,255,0.85)" }}
      >
        <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-10 md:px-16 lg:px-20">
          
          {/* LEFT SIDE: LOGO */}
          <div className="flex items-center shrink-0">
            <Logo withText={true} size="md" />
          </div>

          {/* CENTER: SEARCH BAR */}
          <div className="flex-1 max-w-lg relative mx-12">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search alert ID"
              className="pl-12 bg-white/90 border-cyan-100 text-slate-800 h-11 rounded-xl shadow-sm focus-visible:ring-cyan-500 placeholder:text-slate-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !searching) handleGlobalSearch();
              }}
            />
          </div>

          {/* RIGHT SIDE: ACTIONS */}
          <div className="flex items-center gap-6 shrink-0">
            
            {location.pathname !== "/workspaces" && (
              <Button
                variant="outline"
                onClick={() => navigate("/workspaces")}
                className="border-cyan-200 text-slate-700 bg-white/50 hover:bg-slate-800 hover:text-white transition-all px-6 h-10 rounded-lg font-medium"
              >
                Workspaces
              </Button>
            )}

            {/* Step 1: Trigger the Confirmation UI */}
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(true)}
              className="border-red-100 text-red-600 bg-white/50 hover:bg-red-600 hover:text-white transition-all px-6 h-10 rounded-lg font-medium"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>

          </div>
        </div>
      </header>

      {/* 🛡️ LOGOUT CONFIRMATION MODAL (Step 2) */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-xl">Confirm Logout</DialogTitle>
            <DialogDescription className="text-center text-slate-500 pt-2">
              Are you sure you want to log out of your AquaNex account? You will need to sign in again to access your workspaces.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              variant="ghost"
              className="flex-1 rounded-xl hover:bg-slate-100"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-200"
              onClick={handleConfirmLogout}
            >
              Logout Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GlobalHeader;