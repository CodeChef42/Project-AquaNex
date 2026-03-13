import { useRef } from "react";
import { motion } from "framer-motion";

import wavesIcon from "@/assets/icons/icons8-waves-32.png";
import testTubeIcon from "@/assets/icons/icons8-test-tube-32.png";
import barChartIcon from "@/assets/icons/icons8-bar-chart-48.png";
import wetIcon from "@/assets/icons/icons8-wet-32.png";
import brainIcon from "@/assets/icons/icons8-brain-32.png";
import rightArrowIcon from "@/assets/icons/icons8-right-arrow-32.png";

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
      className="relative py-32 overflow-hidden"
      ref={ref}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 -z-10">

        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px]"
          style={{ background: "rgba(134,239,172,0.15)" }}
          animate={{ x: [0, 120, -100, 0], y: [0, -80, 100, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />

        <motion.div
          className="absolute right-0 top-1/3 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: "rgba(96,165,250,0.15)" }}
          animate={{ x: [0, -120, 80, 0], y: [0, 120, -80, 0] }}
          transition={{ duration: 24, repeat: Infinity }}
        />

      </div>

      <div className="mx-auto max-w-7xl px-6">

        {/* Header */}
        <motion.div
          className="mb-20 flex flex-col justify-between gap-6 md:flex-row md:items-end"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div>
            <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-[#16a34a]">
              Platform
            </span>

            <h2 className="font-display text-5xl leading-[1.05] text-foreground md:text-6xl">
              5 AI Agents.
              <br />
              One <em className="text-[#16a34a]">Platform.</em>
            </h2>
          </div>

          <motion.p
            className="max-w-md text-lg leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Each AI agent focuses on a critical layer of irrigation intelligence,
            working together to create autonomous water optimization.
          </motion.p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

          {agents.map((agent, i) => (

            <motion.div
              key={agent.title}

              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}

              viewport={{ once: true }}

              transition={{
                duration: 0.5,
                delay: i * 0.12,
              }}

              whileHover={{
                y: -10,
                scale: 1.03,
              }}

              className="group relative rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:shadow-2xl cursor-pointer"
            >

              {/* glowing hover border */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(134,239,172,0.4), 0 20px 40px rgba(0,0,0,0.2), 0 0 60px rgba(134,239,172,0.2)",
                }}
              />

              {/* Icon */}
              <motion.div
                className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl ${
                  agent.color === "#16a34a" ? "bg-[#16a34a]/10" : "bg-accent/10"
                }`}
                whileHover={{
                  rotate: 6,
                  scale: 1.1,
                }}
              >
                <img
                  src={agent.icon}
                  alt={agent.title}
                  className="h-9 w-9 object-contain"
                />
              </motion.div>

              {/* Title */}
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {agent.title}
              </h3>

              {/* Description */}
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                {agent.description}
              </p>

              {/* Learn more */}
              <motion.div
                className="flex items-center gap-2 text-sm font-medium text-[#16a34a] opacity-0 group-hover:opacity-100"
                initial={{ x: -5 }}
                whileHover={{ x: 6 }}
              >
                Learn more

                <motion.img
                  src={rightArrowIcon}
                  alt="arrow"
                  className="h-4 w-4"
                  animate={{ x: [0, 6, 0] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                  }}
                />
              </motion.div>

            </motion.div>

          ))}

        </div>

      </div>
    </section>
  );
};

export default FeaturesSection;