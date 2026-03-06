import { ReactNode } from "react";
import GlobalHeader from "./GlobalHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useLocation } from "react-router-dom";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  const showWorkspaceShell = location.pathname !== "/workspaces";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {showWorkspaceShell && <AppSidebar />}
        <div className="flex flex-col flex-1 min-w-0">
          {showWorkspaceShell && <GlobalHeader />}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
