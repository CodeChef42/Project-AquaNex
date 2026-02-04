import { Search, User, Settings, LogOut, LayoutDashboard, GitBranch, Droplet, TrendingUp, TestTube, LineChart, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Logo from "@/components/Logo";

const GlobalHeader = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear any user session data here if needed
    // For example: localStorage.removeItem('authToken');
    
    // Show logout success message
    toast.success("Successfully logged out");
    
    // Redirect to landing page
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 h-16 border-b bg-card flex items-center px-6 gap-4">
      
      {/* Logo */}
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate("/home")}
      >
        <Logo withText size="md" />
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search across platform..."
          className="pl-10 bg-muted/50 border-border"
        />
      </div>

      {/* Profile Menu */}
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
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default GlobalHeader;
