import { useRef } from "react";
import { Droplets, FlaskConical, BarChart3, Waves, BrainCircuit, ArrowRight } from "lucide-react";

const agents = [
  {
    icon: Waves,
    title: "Pipeline Agent",
    description:
      "Real-time leak detection and flow monitoring across your entire pipeline network. Prevent water loss before it happens.",
    color: "primary",
  },
  {
    icon: FlaskConical,
    title: "Soil Agent",
    description:
      "Continuous salinity and pH monitoring with automated alerts. Keep your soil health optimal for every crop cycle.",
    color: "accent",
  },
  {
    icon: BarChart3,
    title: "Demand Agent",
    description:
      "Predictive water demand forecasting using weather, crop type, and historical data. Allocate resources with precision.",
    color: "primary",
  },
  {
    icon: Droplets,
    title: "Quality Agent",
    description:
      "Monitor water quality metrics including TDS, turbidity, and contaminant levels. Ensure safe irrigation at every outlet.",
    color: "accent",
  },
  {
    icon: BrainCircuit,
    title: "Analytics Agent",
    description:
      "Unified dashboard with AI-driven insights, anomaly detection, and ROI reporting across all water management operations.",
    color: "primary",
  },
];

const FeaturesSection = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <section id="features" className="section-padding py-24" ref={ref}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Platform
            </span>
            <h2 className="font-display text-4xl leading-[1.1] text-foreground md:text-5xl lg:text-6xl">
              5 AI Agents.
              <br />
              One <em>Platform.</em>
            </h2>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            Each agent specializes in a critical aspect of water management, working together to deliver
            zero-waste irrigation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.title}
                className={`group relative cursor-pointer rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                  i === 4 ? "md:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${
                    agent.color === "primary" ? "bg-primary/10" : "bg-accent/10"
                  }`}
                >
                  <Icon size={22} className={agent.color === "primary" ? "text-primary" : "text-accent"} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{agent.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{agent.description}</p>
                <div className="flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Learn more <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
