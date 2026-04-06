import { useState } from "react";
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
import { Button } from "@/components/ui/button";



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
  const { workspace, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const items = allItems.filter(
    (item) => item.module === null || workspace?.modules?.includes(item.module)
  );

  return (
    <>
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

        <SidebarFooter className="p-2">
          {open ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-slate-500 hover:text-red-500 hover:bg-red-50"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout</span>
            </Button>
          ) : (
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:text-red-500 hover:bg-red-50"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Logout</h2>
            <p className="text-sm text-slate-500">Are you sure you want to log out?</p>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => { logout(); setShowLogoutConfirm(false); }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}