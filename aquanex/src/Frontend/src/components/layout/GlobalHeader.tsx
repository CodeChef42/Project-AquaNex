import { Search, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import api from "@/lib/api";

const GlobalHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const handleGlobalSearch = async () => {
    const value = query.trim().replace(/^#/, "");
    if (!value) return;
    setSearching(true);
    try {
      const res = await api.get("/incidents/");
      const payload = res.data;
      const incidents = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
      const normalized = value.toLowerCase();
      const exact = incidents.find((inc: any) => String(inc?.id || "").toLowerCase() === normalized);
      const partial = incidents.find((inc: any) => String(inc?.id || "").toLowerCase().includes(normalized));
      const matchedId = String(exact?.id || partial?.id || value);
      navigate(`/pipeline/alerts?alertId=${encodeURIComponent(matchedId)}`);
    } finally {
      setSearching(false);
    }
  };

  return (
    // ✅ inline style forces glass bg regardless of sidebar CSS variable overrides
    <header
      className="h-20 border-b border-cyan-200/60 flex items-center justify-between px-4 shrink-0 backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.6)" }}
    >
      <div className="flex items-center">
        <Logo withText={true} size="md" />
      </div>

      <div className="flex-1 max-w-xl relative mx-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search alert ID"
          className="pl-10 bg-white/70 border-cyan-200 text-slate-800 placeholder:text-slate-400 focus-visible:ring-cyan-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !searching) handleGlobalSearch();
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* ✅ Removed "Workspaces" text button — replaced with icon only */}
        {location.pathname !== "/workspaces" && (
          <Button
            variant="outline"
            onClick={() => navigate("/workspaces")}
            className="border-cyan-200 text-slate-700 bg-white/70 hover:bg-slate-700 hover:text-white hover:border-slate-700 transition-colors">
            Workspaces
          </Button>
        )}


      </div>
    </header>
  );
};

export default GlobalHeader;
