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

  // Consolidate the colors so the Logo, Links, and Buttons all share the exact same logic
  const defaultTextColor = scrolled ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)";
  const hoverTextColor = scrolled ? "#000000" : "#ffffff";
  const logoColor = scrolled ? "#000000" : "#ffffff";

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
      <div className="px-10 md:px-20 flex items-center justify-between py-4">

        {/* LOGO WRAPPER: Removed the extra span so it doesn't duplicate */}
        <motion.div
          animate={{ scale: scrolled ? 0.92 : 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center cursor-pointer transition-colors duration-300"
          style={{ color: logoColor }}
        >
          <Logo size="md" />
        </motion.div>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link, i) => (
            <motion.a
              key={link.label}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: defaultTextColor }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              onMouseEnter={e => (e.currentTarget.style.color = hoverTextColor)}
              onMouseLeave={e => (e.currentTarget.style.color = defaultTextColor)}
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
            style={{ color: defaultTextColor }}
            onMouseEnter={e => (e.currentTarget.style.color = hoverTextColor)}
            onMouseLeave={e => (e.currentTarget.style.color = defaultTextColor)}
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
          className="flex h-11 w-11 items-center justify-center rounded-full md:hidden"
          style={{ color: scrolled ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)" }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <span className="text-2xl">{mobileOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-x-0 top-[72px] bottom-0 z-50 flex flex-col bg-white md:hidden"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <nav className="flex flex-col gap-1 p-6">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  className="flex h-14 items-center rounded-xl px-4 text-lg font-medium text-gray-900 transition-colors active:bg-gray-100"
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  {link.label}
                </motion.a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-4 p-6 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={handleLogin}
                className="flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold text-gray-700 active:bg-gray-200 transition-colors"
              >
                Login
              </button>
              <button
                type="button"
                onClick={handleSignUp}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#16a34a] text-base font-bold text-white shadow-lg shadow-green-200 active:scale-[0.98] transition-all"
              >
                Sign Up for Free
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Header;