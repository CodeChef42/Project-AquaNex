import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

interface CounterProps {
  target: number;
  suffix?: string;
  prefix?: string;
  trigger: boolean;
}

const Counter = ({ target, suffix = "", prefix = "", trigger }: CounterProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const step = target / 120;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [target, trigger]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
};

const stats = [
  { value: 25, suffix: "%", label: "Water savings on average" },
  { value: 95, suffix: "%+", label: "AI precision" },
  { value: 10, prefix: "<", suffix: "s", label: "Alert Latency" },
];

const StatsSection = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-200px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [0.4, 1]);

  return (
    <motion.section
      id="impact"
      className="py-20 md:py-32 section-padding overflow-hidden"
      ref={ref}
      style={{ scale, opacity }}
    >
      <div className="mx-auto max-w-7xl">

        <motion.div
          className="mb-12 md:mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#86efac" }}>
            Real-World Impact
          </span>
          <p className="max-w-4xl font-display text-3xl leading-[1.2] sm:text-4xl lg:text-6xl font-extrabold" style={{ color: "#f9fafb" }}>
            Transforming water management with AI-driven precision —{" "}
            <span style={{ color: "#86efac" }}>reducing waste</span>, detecting leaks.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-10 pt-10 sm:grid-cols-2 md:grid-cols-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="flex flex-col gap-2"
            >
              <div className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight" style={{ color: "#86efac" }}>
                <Counter target={stat.value} suffix={stat.suffix} prefix={(stat as any).prefix} trigger={isInView} />
              </div>
              <p className="text-base md:text-lg font-medium" style={{ color: "#d1d5db" }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </motion.section>
  );
};

export default StatsSection;
