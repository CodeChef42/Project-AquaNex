import { useRef } from "react";
import { ArrowRight, Phone } from "lucide-react";

const CTASection = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <section id="contact" className="section-padding py-24">
      <div ref={ref} className="mx-auto max-w-7xl rounded-3xl bg-primary p-10 md:p-16">
        <h2 className="font-display mb-6 max-w-lg text-4xl leading-[1.1] text-primary-foreground md:text-5xl lg:text-6xl">
          Ready for Zero-Waste Irrigation?
        </h2>
        <p className="mb-10 max-w-md text-lg text-primary-foreground/70">
          See how AquaNex AI platform can cut water waste and protect your farm&apos;s future.
          Schedule a live demo.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#" className="btn-pill bg-accent text-accent-foreground">
            Get Started
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-foreground/20">
              <ArrowRight size={14} className="text-accent-foreground" />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
