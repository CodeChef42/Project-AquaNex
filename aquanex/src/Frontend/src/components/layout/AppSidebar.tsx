import {
  LayoutDashboard,
  PipetteIcon as Pipeline,
  Droplet,
  TrendingUp,
  TestTube,
  LineChart,
  History,
  TerminalSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const allItems = [
  { title: "Home", url: "/home", icon: LayoutDashboard, module: null },
  { title: "Pipeline Management", url: "/pipeline", icon: Pipeline, module: "pipeline_management" },
  { title: "Soil Salinity", url: "/soil", icon: Droplet, module: "soil_salinity" },
  { title: "Water Quality", url: "/water", icon: TestTube, module: "water_quality" },
  { title: "Demand Forecasting", url: "/demand", icon: LineChart, module: "demand_forecasting" },
  { title: "Incident Analytics", url: "/analytics", icon: TrendingUp, module: "incident_analytics" },
  { title: "History Log", url: "/history", icon: History, module: "history_log" },
  { title: "Simulation", url: "/simulation", icon: TerminalSquare, module: null },
  { title: "Settings", url: "/settings", icon: Settings, module: null }, // always visible
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { workspace, logout } = useAuth();
  const navigate = useNavigate();

  const items = allItems.filter(
    (item) => item.module === null || workspace?.modules?.includes(item.module)
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Logout button should only appear on the Workspaces page (handled there), 
  // OR we keep it here but only visible if we are NOT on workspaces page?
  // The user said: "add logout button to top right just on the workspaces page no other pages. other pages its in the bottom of sidebar."
  // So "other pages its in the bottom of sidebar" means we should KEEP it here for non-workspaces pages?
  // Re-reading: "workspaces doesnt have sidebar which is perfect, but add logout button to top right just on the workspaces page no other pages. other pages its in the bottom of sidebar."
  // This implies:
  // 1. Workspaces page: No sidebar, Logout at top right.
  // 2. Other pages: Sidebar exists, Logout at bottom of sidebar.
  
  // So I should NOT have removed it from here. I should restore it.

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-sidebar-border/60 bg-sidebar/60 px-2 py-1.5">
          <div className="min-w-0">
            {open && <div className="text-xs font-semibold tracking-wide text-sidebar-foreground">Navigation</div>}
          </div>
          <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} variant="outline">
                    <NavLink
                      to={item.url}
                      className="bg-transparent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {open && <span>Logout</span>}
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
