import { motion, useScroll } from "framer-motion";
import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import StatsSection from "@/components/landing/StatsSection";
import SolutionsSection from "@/components/landing/SolutionsSection";
import CTASection from "@/components/landing/CTASection";
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

const LandingPage = () => {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{ background: "#f5f0e8", scrollBehavior: "smooth" }}
    >
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] origin-left z-50"
        style={{
          scaleX: scrollYProgress,
          background: "#86efac",
        }}
      />

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

        {/* CTA */}
        <motion.div
          style={{ background: "#faf7f2" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <CTASection />
        </motion.div>

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
                  {["Twitter", "LinkedIn", "GitHub"].map((item) => (
                    <li key={item}>
                      <a className="text-sm font-medium text-gray-500 hover:text-[#86efac] transition-colors cursor-pointer">
                        {item}
                      </a>
                    </li>
                  ))}
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