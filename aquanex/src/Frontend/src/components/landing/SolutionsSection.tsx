import { useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";

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

  return (
    <section id="solutions">
      <div className="mx-4 overflow-hidden rounded-t-3xl bg-accent md:mx-8">
        <div className="section-padding py-2">
          <div className="pb-4 pt-8">
            <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em] text-accent-foreground/60">
              Solutions
            </span>
          </div>
          {solutions.map((solution, i) => (
            <div key={solution.title} className="border-b border-accent-foreground/10 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="group flex w-full items-center justify-between py-5 md:py-6"
              >
                <span className="text-left text-xl font-medium text-accent-foreground md:text-2xl">
                  {solution.title}
                </span>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-accent-foreground/30 transition-transform duration-300 group-hover:bg-accent-foreground/10">
                  <ChevronDown
                    size={18}
                    className={`text-accent-foreground transition-transform duration-300 ${
                      openIndex === i ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {openIndex === i && (
                <div className="overflow-hidden">
                  <p className="max-w-xl pb-6 text-sm text-accent-foreground/70">{solution.desc}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="relative h-[500px] overflow-hidden bg-gradient-to-tr from-primary via-accent to-foreground md:h-[600px]">
            {/* Background imagery commented out temporarily */}
            {/* <img
              src={irrigationBg}
              alt="Smart irrigation system in agricultural field"
              className="h-full w-full object-cover"
              loading="lazy"
            /> */}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />

            <div className="section-padding absolute left-0 right-0 top-0 flex items-center justify-between py-5">
              <h3 className="text-2xl font-semibold text-white md:text-3xl">Smart Irrigation</h3>
            </div>

            <div className="section-padding absolute bottom-0 left-0 right-0 grid gap-6 pb-8 md:grid-cols-2">
              <p className="max-w-md text-sm leading-relaxed text-white/80">
                Our AI-powered irrigation system adjusts water flow based on real-time sensor data, weather
                patterns, and predictive models. Reduce waste by up to 35% while ensuring every field gets
                exactly what it needs.
              </p>
              <div className="flex items-end justify-end">
                <div className="relative h-40 w-64 overflow-hidden rounded-xl border border-white/20 bg-foreground/30">
                  {/* <img
                    src={greenhouseImg}
                    alt="Greenhouse irrigation system"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  /> */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-xs leading-relaxed text-white/90">
                      Precision monitoring adapts to weather and soil conditions in real-time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionsSection;
