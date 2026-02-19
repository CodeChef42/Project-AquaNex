import { useEffect, useRef, useState } from "react";

interface CounterProps {
  target: number;
  suffix?: string;
  prefix?: string;
}

const Counter = ({ target, suffix = "", prefix = "" }: CounterProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let start = 0;
    const step = target / 120;

    const timer = setInterval(() => {
      start += step;

      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {count.toLocaleString()}
      {suffix}
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

  return (
    <section id="impact" className="py-24 section-padding" ref={ref}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-16">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            Impact
          </span>
          <p className="max-w-3xl font-display text-3xl leading-[1.2] text-foreground sm:text-4xl lg:text-5xl">
            Transforming water management with AI-driven precision — reducing waste, detecting
            leaks.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 border-t border-border pt-8 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="mb-1 text-3xl font-extrabold text-foreground sm:text-4xl">
                <Counter target={stat.value} suffix={stat.suffix} prefix={(stat as any).prefix} />
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
