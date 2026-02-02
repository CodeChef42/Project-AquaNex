import { Search, User, Settings, LogOut, Menu, ChevronDown, LayoutDashboard, GitBranch, Droplet, TrendingUp, TestTube, LineChart, History } from "lucide-react";
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

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { title: "Pipeline Monitoring", icon: GitBranch, path: "/pipeline" },
  { title: "Soil Salinity", icon: Droplet, path: "/soil-salinity" },
  { title: "Anomaly Analysis", icon: TrendingUp, path: "/anomaly-analysis" },
  { title: "Water Quality", icon: TestTube, path: "/water-quality" },
  { title: "Demand Forecasting", icon: LineChart, path: "/demand-forecasting" },
  { title: "History Log", icon: History, path: "/history" },
];

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
      {/* Navigation Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
            <span className="text-sm font-medium">Navigation</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-2" align="start">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem 
                key={item.path} 
                className="px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(item.path)}
              >
                <Icon className="w-4 h-4 mr-3 text-muted-foreground" />
                <span>{item.title}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logo */}
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate("/dashboard")}
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
