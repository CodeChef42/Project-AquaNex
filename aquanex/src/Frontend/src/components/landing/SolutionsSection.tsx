import { useState, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

const solutions = [
  {
    title: "Leak Detection & Prevention",
    desc: "AI-powered acoustic and pressure sensors detect micro-leaks across pipeline networks before they cause damage or water loss.",
  },
  {
    title: "Salinity Management",
    desc: "Continuous soil and water salinity monitoring with automated flushing cycles to maintain optimal crop growth conditions.",
  },
  {
    title: "Predictive Resource Allocation",
    desc: "Machine learning models forecast water demand using weather, soil moisture, and crop evapotranspiration data.",
  },
  {
    title: "Smart Irrigation Scheduling",
    desc: "Automated zone-by-zone scheduling that adapts in real-time to sensor feedback, saving up to 35% water per season.",
  },
  {
    title: "Water Quality Monitoring",
    desc: "End-to-end water quality tracking from source to field, ensuring compliance and crop safety at every stage.",
  },
];

const SolutionsSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.4], [0.96, 1]);
  const y = useTransform(scrollYProgress, [0, 0.4], [60, 0]);

  return (
    <section
      id="solutions"
      ref={ref}
      className="relative py-20 md:py-32 overflow-hidden bg-[#F5F3ED]"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <motion.div
          className="mb-12 md:mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#16a34a]">
            Our Solutions
          </span>

          <h2 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.1]">
            Intelligence across <br className="hidden md:block" /> every drop of water.
          </h2>
        </motion.div>

        {/* Enhanced Accordion */}
        <div className="space-y-4">
          {solutions.map((solution, i) => {
            const isOpen = openIndex === i;
            const number = (i + 1).toString().padStart(2, "0");

            return (
              <motion.div
                key={solution.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className={`rounded-3xl border backdrop-blur-md overflow-hidden transition-all duration-300 ${
                  isOpen
                    ? "bg-white border-[#16a34a]/30 shadow-lg shadow-[#16a34a]/5"
                    : "bg-white/60 border-black/5 hover:bg-white/80 hover:border-black/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="group flex w-full items-center justify-between px-6 py-6 md:px-8 md:py-8 active:bg-black/5 transition-colors min-h-[4.5rem]"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-6">
                    <span
                      className={`text-sm md:text-base font-medium font-mono transition-colors duration-300 ${
                        isOpen ? "text-[#16a34a]" : "text-gray-400 group-hover:text-gray-600"
                      }`}
                    >
                      {number}
                    </span>
                    <span className="text-left text-lg md:text-2xl font-bold text-gray-900">
                      {solution.title}
                    </span>
                  </div>

                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 ${
                      isOpen
                        ? "bg-[#16a34a] border-[#16a34a] text-white"
                        : "border-black/10 text-gray-500 group-hover:border-black/20 group-hover:bg-gray-50"
                    }`}
                  >
                    {/* Inline SVG replaces the image import */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-8 md:px-8 md:pb-10 pl-[4.5rem] md:pl-[5.5rem]">
                        <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-3xl">
                          {solution.desc}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Smart Irrigation Panel */}
      <motion.div style={{ scale, y }} className="relative mt-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative rounded-3xl overflow-hidden p-10 md:p-16 bg-white border border-[#16a34a]/20 shadow-2xl shadow-[#16a34a]/5">
            {/* Subtle Green Glow Gradient */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_40%,_rgba(134,239,172,0.12),_transparent_60%)]" />

            <div className="relative z-10">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#16a34a]">
                Smart Irrigation
              </span>

              <h3 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight">
                AI that adapts. <br /> Fields that thrive.
              </h3>
            </div>

            <div className="relative z-10 mt-12 grid gap-8 md:grid-cols-2 items-end">
              <motion.p
                className="text-base md:text-lg leading-relaxed text-gray-600 max-w-md"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                Our AI-powered irrigation system adjusts water flow based on
                real-time sensor data, weather patterns, and predictive models.
                Reduce waste by up to 35% while ensuring every field receives
                exactly what it needs.
              </motion.p>

              <motion.div
                className="flex justify-end"
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="relative w-full max-w-[16rem] rounded-2xl p-6 bg-[#F8F9FA] border border-[#16a34a]/20 flex flex-col justify-between aspect-video md:aspect-square lg:aspect-video">
                  <div className="h-8 w-8 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-4">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#16a34a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                     </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-800 leading-relaxed">
                    Precision monitoring adapts to weather and soil conditions
                    in real-time.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default SolutionsSection;