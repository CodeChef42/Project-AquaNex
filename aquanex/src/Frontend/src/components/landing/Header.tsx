import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/Logo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Contact", href: "#contact" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogin = () => { setMobileOpen(false); navigate("/signin"); };
  const handleSignUp = () => { setMobileOpen(false); navigate("/signup"); };

  return (
    <motion.header
      className="fixed left-0 right-0 top-0 z-50"
      animate={{
        backgroundColor: scrolled ? "rgba(245,240,232,0.97)" : "rgba(245,240,232,0)",
        borderBottom: scrolled ? "1px solid rgba(26,26,26,0.1)" : "1px solid transparent",
        boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,0.06)" : "none",
      }}
      
      style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      <div className="section-padding flex items-center justify-between py-4">

        <motion.div
          animate={{ scale: scrolled ? 0.92 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Logo size="md" />
        </motion.div>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link, i) => (
            <motion.a
              key={link.label}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: scrolled ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)" }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              onMouseEnter={e => (e.currentTarget.style.color = scrolled ? "#000000" : "#ffffff")}
              onMouseLeave={e => (e.currentTarget.style.color = scrolled ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)")}
            >
              {link.label}
            </motion.a>
          ))}
        </nav>

        <motion.div
          className="hidden items-center gap-3 md:flex"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button
            type="button"
            onClick={handleLogin}
            className="text-sm font-medium transition-colors"
            style={{ color: scrolled ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#000000")}
            onMouseLeave={e => (e.currentTarget.style.color = scrolled ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)")}
          >
            Login
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            className="text-sm font-semibold px-5 py-2 rounded-full transition-all"
            style={{ background: "#86efac", color: "#0a0a0a" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#bbf7d0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#86efac")}
          >
            Sign Up
          </button>
        </motion.div>

        <button
          type="button"
          className="md:hidden"
          style={{ color: "rgba(255,255,255,0.8)" }}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <span className="text-2xl">{mobileOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="section-padding flex flex-col gap-2 pb-6 md:hidden"
            style={{ background: "rgba(255,255,255,0.98)", borderTop: "1px solid rgba(0,0,0,0.08)" }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                className="px-4 py-2.5 text-sm font-medium"
                style={{ color: "rgba(0,0,0,0.6)" }}
                onClick={() => setMobileOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.06 }}
              >
                {link.label}
              </motion.a>
            ))}
            <div className="mt-4 flex items-center gap-3 px-4">
              <button type="button" onClick={handleLogin} className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>Login</button>
              <button type="button" onClick={handleSignUp} className="text-sm font-semibold px-5 py-2 rounded-full" style={{ background: "#86efac", color: "#0a0a0a" }}>Sign Up</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Header;
