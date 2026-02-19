import { useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Platform", href: "#platform" },
  { label: "Impact", href: "#impact" },
  { label: "Solutions", href: "#solutions" },
  { label: "Resources", href: "#resources" },
  { label: "Contact", href: "#contact" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    setMobileOpen(false);
    navigate("/signin");
  };

  const handleGetStarted = () => {
    setMobileOpen(false);
    navigate("/signin");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="section-padding flex items-center justify-between py-4">
        <Logo size="md" />

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={handleLogin}
            className="text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Login
          </button>
          <button type="button" onClick={handleGetStarted} className="btn-primary text-sm">
            Get Started
            <ArrowRight size={14} />
          </button>
        </div>

        <button
          type="button"
          className="text-foreground md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="section-padding flex flex-col gap-2 border-t border-border bg-background pb-6 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-4 flex items-center gap-3 px-4">
            <button
              type="button"
              onClick={handleLogin}
              className="text-sm font-medium text-foreground"
            >
              Login
            </button>
            <button type="button" onClick={handleGetStarted} className="btn-primary text-sm">
              Get Started
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

