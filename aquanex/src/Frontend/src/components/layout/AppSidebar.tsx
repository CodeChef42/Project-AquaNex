import {
  LayoutDashboard,
  PipetteIcon as Pipeline,
  Droplet,
  TrendingUp,
  TestTube,
  LineChart,
  History,
  TerminalSquare,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

const allItems = [
  { title: "Home", url: "/home", icon: LayoutDashboard, module: null }, // always visible
  { title: "Pipeline Management", url: "/pipeline", icon: Pipeline, module: "pipeline_management" },
  { title: "Soil Salinity", url: "/soil-salinity", icon: Droplet, module: "soil_salinity" },
  { title: "Water Quality", url: "/water-quality", icon: TestTube, module: "water_quality" },
  { title: "Demand Forecasting", url: "/demand-forecasting", icon: LineChart, module: "demand_forecasting" },
  { title: "Incident Analytics", url: "/incident-analytics", icon: TrendingUp, module: "incident_analytics" },
  { title: "History Log", url: "/history", icon: History, module: "history_log" },
  { title: "Simulation", url: "/simulation", icon: TerminalSquare, module: null },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { workspace } = useAuth();

  const items = allItems.filter(
    (item) => item.module === null || workspace?.modules?.includes(item.module)
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <div className="p-4 border-b">
          <SidebarTrigger />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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
    </Sidebar>
  );
}
