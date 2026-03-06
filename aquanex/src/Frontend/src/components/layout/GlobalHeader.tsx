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
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center">
        <Logo withText={false} size="lg" />
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search alert ID (e.g. 123 or uuid)"
          className="pl-10 bg-muted/50 border-border"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !searching) {
              handleGlobalSearch();
            }
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Workspaces Button */}
        {location.pathname !== "/workspaces" && (
          <Button variant="outline" onClick={() => navigate("/workspaces")}>
            Workspaces
          </Button>
        )}

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card">
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default GlobalHeader;
