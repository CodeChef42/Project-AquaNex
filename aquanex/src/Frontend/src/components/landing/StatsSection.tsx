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
      className="py-24 section-padding"
      ref={ref}
      style={{ scale, opacity }}
    >
      <div className="mx-auto max-w-7xl">

        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "#86efac" }}>
            Impact
          </span>
          <p className="max-w-3xl font-display text-3xl leading-[1.2] sm:text-4xl lg:text-5xl" style={{ color: "#f9fafb" }}>
            Transforming water management with AI-driven precision —{" "}
            <span style={{ color: "#86efac" }}>reducing waste</span>, detecting leaks.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-8 pt-8 md:grid-cols-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="mb-1 text-3xl font-extrabold sm:text-4xl" style={{ color: "#86efac" }}>
                <Counter target={stat.value} suffix={stat.suffix} prefix={(stat as any).prefix} trigger={isInView} />
              </div>
              <p className="text-sm" style={{ color: "#d1d5db" }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </motion.section>
  );
};

export default StatsSection;
