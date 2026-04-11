import { useState, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
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

const EcosystemAnimation = () => {
  const colorCycle = ["#3b82f6", "#10b981", "#eab308", "#3b82f6"];
  const plantXPositions = [150, 350, 550, 750];

  return (
    <div className="absolute inset-0 z-0 overflow-hidden rounded-[2.5rem] pointer-events-none bg-white">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="glowDrop" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowRain" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="soilBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a67c52" />
            <stop offset="100%" stopColor="#5c3a21" />
          </linearGradient>
          <linearGradient id="rainDrop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* --- SOIL BED --- */}
        <rect x="0" y="480" width="1000" height="120" fill="url(#soilBg)" opacity="0.9" />
        <path d="M0,480 Q250,460 500,480 T1000,470" fill="none" stroke="#4a2e1b" strokeWidth="4" />

        {/* --- RAIN DROPLETS FALLING ONTO PLANTS --- */}
        {plantXPositions.map((px, pi) =>
          [...Array(4)].map((_, di) => {
            const offsetX = (di - 1.5) * 14;
            const startY = 60 + di * 20;
            const endY = 435;
            const duration = 1.4 + di * 0.18;
            const delay = pi * 0.35 + di * 0.28;

            return (
              <motion.g key={`rain-${pi}-${di}`}>
                <motion.ellipse
                  cx={px + offsetX}
                  cy={0}
                  rx={2}
                  ry={5}
                  fill="url(#rainDrop)"
                  filter="url(#glowRain)"
                  animate={{
                    cy: [startY, endY],
                    opacity: [0, 0.85, 0.85, 0],
                    scaleX: [0.8, 1, 1.2],
                  }}
                  transition={{
                    duration,
                    repeat: Infinity,
                    delay,
                    ease: "easeIn",
                  }}
                />
                <motion.ellipse
                  cx={px + offsetX}
                  cy={endY}
                  rx={0}
                  ry={0}
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth="1.5"
                  animate={{
                    rx: [0, 10, 14],
                    ry: [0, 3, 4],
                    opacity: [0, 0.7, 0],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: delay + duration * 0.88,
                    ease: "easeOut",
                    repeatDelay: duration - 0.5,
                  }}
                />
              </motion.g>
            );
          })
        )}

        {/* --- SENSORS & WIRES --- */}
        {[300, 500].map((x, i) => (
          <g key={`sensor-group-${i}`}>
            <motion.path
              d={`M 700 200 C 700 350, ${x} 350, ${x} 520`}
              fill="none"
              strokeWidth="2"
              strokeDasharray="6 6"
              opacity="0.4"
              animate={{ stroke: colorCycle }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            <rect x={x - 10} y="510" width="20" height="40" rx="4" fill="#1e293b" />
            <motion.circle
              cx={x}
              cy="520"
              r="4"
              animate={{ fill: colorCycle, opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </g>
        ))}

        {/* --- AI CENTER HUB --- */}
        <motion.g transform="translate(700, 200)">
          <motion.circle
            r="80"
            fill="none"
            strokeWidth="2"
            strokeDasharray="10 15"
            opacity="0.2"
            animate={{ rotate: 360, stroke: colorCycle }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <g transform="translate(-25, -25)">
            <motion.rect
              x="0"
              y="0"
              width="50"
              height="50"
              rx="8"
              fill="white"
              strokeWidth="3"
              animate={{ stroke: colorCycle }}
              transition={{ duration: 10, repeat: Infinity }}
            />
            <motion.path
              d="M15 -6 v6 M35 -6 v6 M15 50 v6 M35 50 v6 M-6 15 h6 M-6 35 h6 M50 15 h6 M50 35 h6"
              strokeWidth="3"
              strokeLinecap="round"
              animate={{ stroke: colorCycle }}
              transition={{ duration: 10, repeat: Infinity }}
            />
            <text x="13" y="32" fontSize="18" fontWeight="900" fill="#16a34a" fontFamily="Arial">
              AI
            </text>
          </g>
        </motion.g>

        {/* --- GRAPHIC LEAFY PLANTS --- */}
        {plantXPositions.map((x, i) => (
          <motion.g
            key={`plant-${i}`}
            transform={`translate(${x}, 485)`}
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i }}
          >
            <motion.path
              d="M0,0 L0,-50"
              strokeWidth="5"
              strokeLinecap="round"
              animate={{ stroke: colorCycle }}
              transition={{ duration: 10, repeat: Infinity }}
            />
            <motion.path
              d="M0,-45 C-30,-45 -40,-10 0,-10 C40,-10 30,-45 0,-45"
              animate={{ fill: colorCycle }}
              opacity="0.8"
              transition={{ duration: 10, repeat: Infinity }}
            />
            <motion.path
              d="M0,-25 C-20,-25 -25,-5 0,-5 C25,-5 20,-25 0,-25"
              transform="rotate(40)"
              animate={{ fill: colorCycle }}
              opacity="0.6"
              transition={{ duration: 10, repeat: Infinity, delay: 0.5 }}
            />
          </motion.g>
        ))}

        {/* --- WATER DROPLETS --- */}
        {[...Array(20)].map((_, j) => (
          <motion.circle
            key={`drop-${j}`}
            cx={900}
            r="5"
            fill="#3b82f6"
            filter="url(#glowDrop)"
            animate={{
              x: [0, -300 - j * 35],
              y: [480, 330, 580],
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: j * 0.2,
              ease: "easeOut",
            }}
          />
        ))}

      </svg>
    </div>
  );
};

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
      className="relative py-20 md:py-32 overflow-hidden"
      style={{ background: "rgba(245,240,232,0.97)" }}
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
          <span
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: "#16a34a" }}
          >
            Our Solutions
          </span>
          <h2 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.1]">
            Intelligence across <br className="hidden md:block" /> every drop of water.
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-4">
          {solutions.map((solution, i) => (
            <motion.div
              key={solution.title}
              className="rounded-3xl border backdrop-blur-md overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.7)",
                borderColor: "rgba(0,0,0,0.06)",
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="group flex w-full items-center justify-between px-6 py-6 md:px-8 md:py-8 active:bg-black/5 transition-colors min-h-[4.5rem]"
              >
                <span className="text-left text-lg md:text-2xl font-bold text-gray-900">
                  {solution.title}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border border-black/10 transition-all duration-300 group-hover:bg-[#16a34a] group-hover:text-white"
                >
                  <img
                    src={chevronDownIcon}
                    alt=""
                    className="h-4 w-4 md:h-5 md:w-5 group-hover:brightness-0 group-hover:invert"
                  />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-8 md:px-8 md:pb-10"
                  >
                    <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-3xl">
                      {solution.desc}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* --- THE MAIN SMART IRRIGATION CARD --- */}
      <motion.div style={{ scale, y }} className="relative mt-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative rounded-[2.5rem] p-8 md:p-14 min-h-[580px] border border-gray-200 shadow-2xl shadow-green-900/5 bg-white overflow-hidden">
            <EcosystemAnimation />

            <div className="relative z-10 grid md:grid-cols-12 gap-10 h-full">
              {/* Left Side Column */}
              <div className="md:col-span-6 space-y-8 self-start">
                <div>
                  <span className="inline-block px-3 py-1 bg-white/60 backdrop-blur-md text-gray-800 text-xs font-bold uppercase tracking-widest rounded-full mb-8 border border-black/5 shadow-sm">
                    Smart Irrigation
                  </span>
                  <h3 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight drop-shadow-sm">
                    AI THAT ADAPTS.
                    <br /> FIELDS THAT THRIVE.
                  </h3>
                </div>
                <div className="p-6 rounded-2xl bg-white/70 backdrop-blur-md border border-white shadow-lg max-w-md">
                  <p className="text-sm md:text-base leading-relaxed text-gray-800 font-medium">
                    Our AI-powered irrigation system adjusts water flow based on real-time sensor
                    data, weather patterns, and predictive models. Reduce waste by up to 35% while
                    ensuring every field receives exactly what it needs.
                  </p>
                </div>
              </div>

              {/* Right Side Column */}
              <div className="md:col-span-6 flex flex-col justify-between items-end h-full">
                <div className="p-6 rounded-3xl bg-white/60 backdrop-blur-lg border border-white/80 shadow-xl w-full max-w-sm">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-4 shadow-sm">
                    <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                    Precision monitoring adapts to weather and soil conditions in real-time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default SolutionsSection;