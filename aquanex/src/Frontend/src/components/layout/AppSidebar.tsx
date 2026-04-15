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
  Bot,
  Info, // Ensure Info is imported
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

// Removed "Information" from here to keep main nav clean
const allItems = [
  { title: "Home", url: "/home", icon: LayoutDashboard, module: null },
  { title: "Pipeline Management", url: "/pipeline", icon: Pipeline, module: "pipeline_management" },
  { title: "Soil Salinity", url: "/soil-salinity", icon: Droplet, module: "soil_salinity" },
  { title: "Water Quality", url: "/water-quality", icon: TestTube, module: "water_quality" },
  { title: "Demand Forecasting", url: "/demand-forecasting", icon: LineChart, module: "demand_forecasting" },
  { title: "Incident Analytics", url: "/incident-analytics", icon: TrendingUp, module: "incident_analytics" },
  { title: "History Log", url: "/history", icon: History, module: "history_log" },
  { title: "Simulation", url: "/simulation", icon: TerminalSquare, module: null },
  { title: "Settings", url: "/settings", icon: Settings, module: null },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { workspace } = useAuth();

  const items = allItems.filter(
    (item) => item.module === null || workspace?.modules?.includes(item.module)
  );

  return (
    <Sidebar collapsible="icon" className="bg-white/70 backdrop-blur-sm border-r border-cyan-100">
      <SidebarHeader className="p-3">
        {open ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-cyan-100 bg-white/60 px-2 py-1.5">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase pl-1">
              Navigation
            </span>
            <SidebarTrigger className="text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 shrink-0" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <SidebarTrigger className="text-slate-500 hover:bg-cyan-50 hover:text-cyan-700" />
          </div>
        )}
      </SidebarHeader>

      <SidebarSeparator className="bg-cyan-100" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title} className="border-b border-cyan-100/70 last:border-b-0">
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    className="rounded-none hover:bg-cyan-50/80 transition-colors text-slate-600"
                  >
                    <NavLink
                      to={item.url}
                      className="bg-transparent"
                      activeClassName="bg-cyan-100/70 text-cyan-700 font-medium"
                    >
                      <item.icon className="w-4 h-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ✅ NEW: Information button pinned to the absolute bottom */}
      <SidebarFooter className="p-2 border-t border-cyan-100">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="AI Help"
              className="hover:bg-cyan-50 transition-colors text-slate-500 hover:text-cyan-700"
            >
              <NavLink
                to="/info/assistant"
                className="flex items-center gap-2"
                activeClassName="text-cyan-700 font-medium"
              >
                <Bot className="w-4 h-4 shrink-0" />
                {open && <span>AI Help</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Information"
              className="hover:bg-cyan-50 transition-colors text-slate-500 hover:text-cyan-700"
            >
              <NavLink 
                to="/info" 
                className="flex items-center gap-2"
                activeClassName="text-cyan-700 font-medium"
              >
                <Info className="w-4 h-4 shrink-0" />
                {open && <span>Information</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
