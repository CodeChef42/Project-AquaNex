import { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import chevronDownIcon from "@/assets/icons/icons8-chevron-down-26.png";

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
      className="relative py-32"
      style={{ background: "rgba(245,240,232,0.97)" }} // light background
    >

      <div className="relative mx-auto max-w-6xl px-6">

        {/* Header */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#16a34a" }} // darker green for light theme
          >
            Solutions
          </span>

          <h2 className="mt-3 text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            Intelligence across <br /> every drop of water.
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-4">
          {solutions.map((solution, i) => (
            <motion.div
              key={solution.title}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="rounded-2xl border backdrop-blur-md"
              style={{
                background: "rgba(255, 255, 255, 0.7)", // light frosted card
                borderColor: "rgba(0,0,0,0.06)",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenIndex(openIndex === i ? null : i)
                }
                className="group flex w-full items-center justify-between px-6 py-6"
              >
                <span className="text-left text-xl md:text-2xl font-medium text-gray-900">
                  {solution.title}
                </span>

                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 group-hover:scale-110"
                  style={{
                    borderColor: "rgba(0,0,0,0.12)",
                  }}
                >
                  <img src={chevronDownIcon} className="h-4 w-4" />
                </motion.div>
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: openIndex === i ? "auto" : 0,
                  opacity: openIndex === i ? 1 : 0,
                }}
                transition={{ duration: 0.35 }}
                style={{ overflow: "hidden" }}
              >
                <p className="px-6 pb-6 text-sm leading-relaxed text-gray-700 max-w-xl">
                  {solution.desc}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Smart Irrigation Panel */}
      <motion.div
        style={{ scale, y }}
        className="relative mt-28"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div
            className="relative rounded-3xl overflow-hidden p-10 md:p-16"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(22,163,74,0.15)",
            }}
          >
            {/* subtle green glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 70% 40%, rgba(134,239,172,0.08), transparent 60%)",
              }}
            />

            <div className="relative z-10">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#16a34a" }}
              >
                Smart Irrigation
              </span>

              <h3 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
                AI that adapts. <br /> Fields that thrive.
              </h3>
            </div>

            <div className="relative z-10 mt-12 grid gap-8 md:grid-cols-2 items-end">
              <motion.p
                className="text-sm leading-relaxed text-gray-700 max-w-md"
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
                <div
                  className="relative h-40 w-64 rounded-2xl p-5 flex items-end"
                  style={{
                    background: "#f3f4f6",
                    border: "1px solid rgba(22,163,74,0.2)",
                  }}
                >
                  <p className="text-xs text-green-600 leading-relaxed">
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