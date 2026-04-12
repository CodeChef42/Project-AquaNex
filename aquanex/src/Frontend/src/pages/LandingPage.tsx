import { motion, useAnimation, AnimationControls } from "framer-motion";
import { useEffect, useState, useRef, ReactNode } from "react";
import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import StatsSection from "@/components/landing/StatsSection";
import SolutionsSection from "@/components/landing/SolutionsSection";
import Logo from "@/components/Logo";

const articles = [
  {
    title: "Sustainable Water Management in Arid Regions",
    link: "https://www.unwater.org/water-facts/water-quality-and-wastewater",
  },
  {
    title: "Smart Irrigation Best Practices",
    link: "https://www.fao.org/3/i2800e/i2800e.pdf",
  },
  {
    title: "Water Conservation in Agriculture",
    link: "https://www.worldbank.org/en/topic/water-in-agriculture",
  },
];

// Updated to include professional titles
const teamMembers = [
  { name: "Israr", role: "Project Lead" },
  { name: "Saad", role: "Backend Engineer" },
  { name: "Bilal", role: "Frontend Engineer" },
  { name: "Atsushi", role: "AI/ML Engineer" },
  { name: "Abrar", role: "Data Engineer" }
];

// Reusable declarative animated water drop
const WaterDrop = ({ delay = 0, x = 0, y = 0 }: { delay?: number; x?: number; y?: number }) => {
  return (
    <div style={{ position: "absolute", left: `calc(50% + ${x}px)`, top: y, pointerEvents: "none" }}>
      {/* Falling Drop */}
      <motion.div
        animate={{ 
          y: [0, 70], 
          opacity: [0, 0.8, 0], 
          scaleY: [1, 1.5, 0.8] 
        }}
        transition={{ 
          duration: 1.2, 
          repeat: Infinity, 
          delay: delay, 
          ease: "easeIn" 
        }}
        style={{
          width: 6,
          height: 14,
          borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
          background: "linear-gradient(to bottom, #86efac, #60a5fa)",
          boxShadow: "0 0 8px rgba(96, 165, 250, 0.5)",
        }}
      />
      
      {/* Ground Splash */}
      <motion.div
        animate={{ 
          scale: [0, 2.5], 
          opacity: [0, 0.6, 0] 
        }}
        transition={{ 
          duration: 0.6, 
          repeat: Infinity, 
          delay: delay + 1.1, // Splash triggers right as drop hits bottom
          ease: "easeOut" 
        }}
        style={{
          width: 16,
          height: 6,
          borderRadius: "50%",
          background: "#60a5fa",
          position: "absolute",
          top: 68,
          left: -5,
        }}
      />
    </div>
  );
};

// Simplified container that fades in on hover
const IrrigationAnimation = ({ isHovered }: { isHovered: boolean }) => {
  const dropsRef = useRef<{ id: number; delay: number; x: number; y: number }[]>([]);

  useEffect(() => {
    // Generate static random positions once on mount so they don't jitter
    dropsRef.current = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: Math.random() * 2, // Random start delay
      x: Math.random() * 160 - 80, // Spread across the card width
      y: Math.random() * 20 - 10, // Slight vertical variation
    }));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isHovered ? 1 : 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: "1rem",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* Background glow when active */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#86efac]/5 to-[#60a5fa]/10" />
      
      {/* Render the drops */}
      {dropsRef.current.map((drop) => (
        <WaterDrop key={drop.id} delay={drop.delay} x={drop.x} y={drop.y} />
      ))}
      
      {/* Simulated ground line */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#60a5fa]/30 to-transparent" />
    </motion.div>
  );
};

const LandingPage = () => {
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{ background: "#f5f0e8", scrollBehavior: "smooth" }}
    >
      {/* Animated ambient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute w-[900px] h-[900px] rounded-full blur-[140px]"
          style={{ background: "rgba(134,239,172,0.15)" }}
          animate={{
            x: [0, 200, -100, 0],
            y: [0, -100, 200, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="absolute right-0 top-1/3 w-[800px] h-[800px] rounded-full blur-[140px]"
          style={{ background: "rgba(96,165,250,0.15)" }}
          animate={{
            x: [0, -200, 100, 0],
            y: [0, 150, -150, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="page-content">
        <Header />
        <HeroSection />

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <FeaturesSection />
        </motion.div>

        {/* Stats */}
        <motion.div
          style={{ background: "#0a0a0a" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <StatsSection />
        </motion.div>

        {/* Solutions */}
        <motion.div
          style={{ background: "#ffffff" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <SolutionsSection />
        </motion.div>

        {/* Resources Section */}
        <motion.section
          id="resources"
          style={{ background: "#0a0a0a" }}
          className="py-20 md:py-28 overflow-hidden"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="container mx-auto px-6">
            <motion.div
              className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 md:mb-16 gap-6"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "#86efac" }}>
                  Resources & Insights
                </p>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1]" style={{ color: "#f9fafb" }}>
                  Sustainability<br className="hidden md:block" /> Insights
                </h2>
              </div>

              <p className="max-w-md text-base md:text-lg leading-relaxed text-gray-400">
                Insights from leading global agriculture and water research bodies.
              </p>
            </motion.div>

            {/* Article Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {articles.map((article, index) => (
                <motion.a
                  key={index}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between rounded-[2rem] p-8 md:p-10 active:scale-[0.98] transition-all"
                  style={{
                    background: "#141414",
                    border: "1px solid rgba(255,255,255,0.06)",
                    minHeight: "260px",
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <span
                    className="text-xs font-mono mb-8 block font-bold"
                    style={{ color: "#86efac" }}
                  >
                    0{index + 1}
                  </span>

                  <h3
                    className="text-lg md:text-xl font-bold leading-snug mb-8 flex-1"
                    style={{ color: "#f9fafb" }}
                  >
                    {article.title}
                  </h3>

                  <div
                    className="flex items-center justify-between pt-6"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span className="text-xs font-medium text-gray-500">
                      External Link
                    </span>

                    <span
                      className="text-sm font-bold flex items-center gap-2 text-[#86efac]"
                    >
                      Read more <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        </motion.section>

        {/* --- ENHANCED DEVELOPERS / TEAM SECTION (GPU OPTIMIZED) --- */}
        <motion.section
          id="team"
          className="relative py-20 md:py-32 overflow-hidden bg-[#020617]" 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          {/* GPU-Friendly Background Gradient Animation */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            
            {/* Vibrant Cyan Orb */}
            <motion.div
              className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] rounded-full"
              style={{
                background: "radial-gradient(circle at center, rgba(6,182,212,0.35) 0%, rgba(6,182,212,0) 70%)",
                willChange: "transform",
              }}
              animate={{ x: [0, 150, 0], y: [0, 100, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Bright Emerald Orb */}
            <motion.div
              className="absolute top-[10%] -right-[15%] w-[900px] h-[900px] rounded-full"
              style={{
                background: "radial-gradient(circle at center, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0) 70%)",
                willChange: "transform",
              }}
              animate={{ x: [0, -200, 0], y: [0, 150, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Deep Blue Orb */}
            <motion.div
              className="absolute -bottom-[20%] left-[10%] w-[700px] h-[700px] rounded-full"
              style={{
                background: "radial-gradient(circle at center, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0) 70%)",
                willChange: "transform",
              }}
              animate={{ x: [0, 100, -50, 0], y: [0, -150, 0] }}
              transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Subtle Violet Orb for color depth */}
            <motion.div
              className="absolute bottom-[0%] right-[20%] w-[600px] h-[600px] rounded-full"
              style={{
                background: "radial-gradient(circle at center, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0) 70%)",
                willChange: "transform",
              }}
              animate={{ x: [0, -100, 50, 0], y: [0, -50, 50, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <div className="container relative z-20 mx-auto px-6">
            <motion.div 
              className="text-center mb-20"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#86efac] drop-shadow-md">
                The Minds Behind AquaNex
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] text-white drop-shadow-xl">
                Our Developers
              </h2>
            </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.name}
                  className="relative flex flex-col items-center p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:shadow-2xl hover:shadow-[#10b981]/20 transition-all duration-300 overflow-hidden"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }} 
                  onMouseEnter={() => setHoveredMember(member.name)} 
                  onMouseLeave={() => setHoveredMember(null)}
                >
                  <IrrigationAnimation isHovered={hoveredMember === member.name} />

                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#86efac] to-[#0ea5e9] mb-5 flex items-center justify-center shadow-lg shadow-black/50 group z-10 ring-2 ring-white/20">
                    <span className="text-xl font-bold text-[#020617]">{member.name.charAt(0)}</span>
                  </div>
                  
                  {/* Added text-center, whitespace-nowrap, and w-full */}
                  <h3 className="text-lg font-bold text-white z-10 tracking-wide text-center whitespace-nowrap w-full">
                    {member.name}
                  </h3>
                  
                  {/* Added responsive sizing, text-center, and whitespace-nowrap */}
                  <p className="text-[10px] sm:text-xs font-semibold text-[#86efac] mt-1 z-10 uppercase tracking-wider text-center whitespace-nowrap w-full">
                    {member.role}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Contact Section */}
        <motion.section
          id="contact"
          style={{ background: "#0a0a0a" }}
          className="py-20 pt-28 border-b border-white/5"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-[#86efac]">
                Get In Touch
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold leading-[1.1] text-white">
                Contact for Information
              </h2>
            </div>
            
            <form 
              className="space-y-6 max-w-2xl mx-auto p-8 md:p-10 rounded-[2rem] shadow-2xl"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-2">
                  <label htmlFor="name" className="text-sm font-bold text-gray-300">Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    placeholder="Enter your name" 
                    className="px-5 py-4 rounded-xl border focus:outline-none focus:ring-2 transition-all placeholder:text-gray-600 text-white"
                    style={{ background: "#0a0a0a", borderColor: "rgba(255,255,255,0.06)", outlineColor: "#86efac" }}
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  <label htmlFor="email" className="text-sm font-bold text-gray-300">Gmail</label>
                  <input 
                    type="email" 
                    id="email" 
                    placeholder="you@gmail.com" 
                    className="px-5 py-4 rounded-xl border focus:outline-none focus:ring-2 transition-all placeholder:text-gray-600 text-white"
                    style={{ background: "#0a0a0a", borderColor: "rgba(255,255,255,0.06)", outlineColor: "#86efac" }}
                  />
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <label htmlFor="query" className="text-sm font-bold text-gray-300">Query</label>
                <textarea 
                  id="query" 
                  rows={4} 
                  placeholder="How can we help you?" 
                  className="px-5 py-4 rounded-xl border focus:outline-none focus:ring-2 transition-all placeholder:text-gray-600 text-white resize-none"
                  style={{ background: "#0a0a0a", borderColor: "rgba(255,255,255,0.06)", outlineColor: "#86efac" }}
                ></textarea>
              </div>
              <button 
                type="button" 
                className="w-full py-4 text-[#0a0a0a] font-bold rounded-xl transition-transform active:scale-[0.98] mt-4"
                style={{ background: "#86efac" }}
              >
                Send Message
              </button>
            </form>
          </div>
        </motion.section>

        {/* Footer */}
        <footer style={{ background: "#0a0a0a" }} className="py-16 md:py-24">
          <div className="container mx-auto px-6">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 pb-16"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="col-span-1 sm:col-span-2 md:col-span-1">
                <div className="flex items-center space-x-3 mb-6">
                  <Logo size="sm" withText={false} className="text-[#86efac]" />
                  <span className="text-xl font-black tracking-tighter" style={{ color: "#f9fafb" }}>
                    AquaNex
                  </span>
                </div>

                <p className="text-sm leading-relaxed max-w-xs text-gray-500">
                  Smart Irrigation Solutions for Sustainable Agriculture. Leading the way in AI-powered water management.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] mb-6 text-white">
                  Product
                </h4>
                <ul className="space-y-4">
                  {["Features", "Solutions", "Pricing"].map((item) => (
                    <li key={item}>
                      <a className="text-sm font-medium text-gray-500 hover:text-[#86efac] transition-colors cursor-pointer">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] mb-6 text-white">
                  Company
                </h4>
                <ul className="space-y-4">
                  {["About", "Sustainability", "Privacy"].map((item) => (
                    <li key={item}>
                      <a className="text-sm font-medium text-gray-500 hover:text-[#86efac] transition-colors cursor-pointer">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] mb-6 text-white">
                  Social
                </h4>
                <ul className="space-y-4">
                  <li>
                    <a 
                      href="https://www.instagram.com/aquanex.app/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#86efac] transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://github.com/CodeChef42/Project-AquaNex" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#86efac] transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                      GitHub
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://www.linkedin.com/company/aqua-nex/?viewAsMember=true" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#86efac] transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                      LinkedIn
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-gray-600">
              <p>© 2026 AquaNex AI. All rights reserved.</p>
              <p>Designed for Sustainable Agriculture</p>
            </div>
          </div>
        </footer>

      </div>
    </motion.div>
  );
};

export default LandingPage;