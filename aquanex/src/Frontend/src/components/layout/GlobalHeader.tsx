import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Logo from "@/components/Logo";

const GlobalHeader = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Successfully logged out");
    navigate("/");
  };

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      <Logo />
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4" />
        Logout
      </Button>
    </header>
  );
};

export default GlobalHeader;
