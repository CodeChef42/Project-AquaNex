import { ReactNode } from "react";
import GlobalHeader from "./GlobalHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useLocation } from "react-router-dom";
import { LeafDecor } from "@/components/LeafDecor";


interface MainLayoutProps {
  children: ReactNode;
}


const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  const showWorkspaceShell = location.pathname !== "/workspaces";


  return (
    <SidebarProvider>
      {/* ✅ Cyan radial gradient background — matches SignIn exactly */}
      <div className="relative min-h-screen flex w-full
        bg-[radial-gradient(ellipse_at_top_left,_#ecfeff_0%,_#f0fdfa_35%,_#e0f2fe_70%,_#f8fafc_100%)]
        dark:bg-[radial-gradient(ellipse_at_top_left,_#042f2e_0%,_#0c1a2e_40%,_#061220_70%,_#020d18_100%)]">

        {/* ✅ LeafDecor fixed behind everything, no pointer interference */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <LeafDecor />
        </div>

        {/* ✅ All layout content sits above the decor */}
        <div className="relative z-10 flex w-full min-h-screen">
          {showWorkspaceShell && <AppSidebar />}
          <div className="flex flex-col flex-1 min-w-0">
            {showWorkspaceShell && <GlobalHeader />}
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>

      </div>
    </SidebarProvider>
  );
};


export default MainLayout;
