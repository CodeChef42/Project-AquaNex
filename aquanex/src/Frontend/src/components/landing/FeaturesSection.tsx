import { useRef } from "react";
import { motion } from "framer-motion";

import wavesIcon from "@/assets/icons/icons8-waves-32.png";
import testTubeIcon from "@/assets/icons/icons8-test-tube-32.png";
import barChartIcon from "@/assets/icons/icons8-bar-chart-48.png";
import wetIcon from "@/assets/icons/icons8-wet-32.png";
import brainIcon from "@/assets/icons/icons8-brain-32.png";

const agents = [
  {
    icon: wavesIcon,
    title: "Pipeline Agent",
    description:
      "Real-time leak detection and flow monitoring across your entire pipeline network. Prevent water loss before it happens.",
    color: "accent",
  },
  {
    icon: testTubeIcon,
    title: "Soil Agent",
    description:
      "Continuous salinity and pH monitoring with automated alerts. Keep your soil health optimal for every crop cycle.",
    color: "accent",
  },
  {
    icon: barChartIcon,
    title: "Demand Agent",
    description:
      "Predictive water demand forecasting using weather, crop type, and historical data. Allocate resources with precision.",
    color: "accent",
  },
  {
    icon: wetIcon,
    title: "Quality Agent",
    description:
      "Monitor water quality metrics including TDS, turbidity, and contaminant levels. Ensure safe irrigation at every outlet.",
    color: "accent",
  },
  {
    icon: brainIcon,
    title: "Analytics Agent",
    description:
      "Unified dashboard with AI-driven insights, anomaly detection, and ROI reporting across all water management operations.",
    color: "accent",
  },
];

const FeaturesSection = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <section
      id="features"
      className="relative py-20 md:py-32 overflow-hidden"
      style={{ background: "#faf7f2", isolation: "isolate" }}
      ref={ref}
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        {/* Green Glow */}
        <motion.div
          className="absolute -top-20 -left-20 w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full blur-[80px] md:blur-[120px]"
          style={{ background: "rgba(134,239,172,0.15)" }}
          animate={{ x: [0, 60, -50, 0], y: [0, -40, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Blue Glow */}
        <motion.div
          className="absolute bottom-0 right-0 w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full blur-[80px] md:blur-[120px]"
          style={{ background: "rgba(56,189,248,0.12)" }} 
          animate={{ x: [0, -40, 30, 0], y: [0, 50, -40, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 relative" style={{ zIndex: 1 }}>

        {/* Header */}
        <motion.div
          className="mb-16 md:mb-20 flex flex-col justify-between gap-6 md:flex-row md:items-end"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="max-w-2xl">
            <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-[#16a34a]">
              Platform Intelligence
            </span>

            <h2 className="font-display text-4xl leading-[1.1] text-foreground md:text-6xl lg:text-7xl font-extrabold">
              5 AI Agents.
              <br />
              One <em className="text-[#16a34a] not-italic">Platform.</em>
            </h2>
          </div>

          <motion.p
            className="max-w-md text-base md:text-lg text-muted-foreground leading-relaxed"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Our modular ecosystem of AI agents provides 360° visibility into your water network, from soil health to pipeline integrity.
          </motion.p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.title}
              className="group relative flex flex-col rounded-3xl border border-black/5 bg-white p-8 transition-all hover:border-[#16a34a]/30 hover:shadow-xl hover:shadow-green-900/5 active:scale-[0.98] md:p-10"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0fdf4] text-[#16a34a] transition-transform group-hover:scale-110 md:h-16 md:w-16">
                <img src={agent.icon} alt="" className="h-7 w-7 md:h-8 md:w-8" />
              </div>

              <h3 className="mb-4 text-xl font-bold text-gray-900 md:text-2xl">
                {agent.title}
              </h3>

              <p className="text-sm md:text-base leading-relaxed text-gray-600">
                {agent.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;