import {
  LayoutDashboard,
  PipetteIcon as Pipeline,
  Droplet,
  TrendingUp,
  TestTube,
  LineChart,
  History,
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

const items = [
  { title: "Home", url: "/home", icon: LayoutDashboard },
  { title: "Pipeline Management", url: "/pipeline", icon: Pipeline },
  { title: "Soil Salinity", url: "/soil-salinity", icon: Droplet },
  { title: "Water Quality", url: "/water-quality", icon: TestTube },
  { title: "Demand Forecasting", url: "/demand-forecasting", icon: LineChart },
  { title: "Incident Analytics", url: "/incident-analytics", icon: TrendingUp },
  { title: "History Log", url: "/history", icon: History },
];

export function AppSidebar() {
  const { open } = useSidebar();

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
