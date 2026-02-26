import playIcon from "@/assets/icons/icons8-play-32.png";
import rightArrowIcon from "@/assets/icons/icons8-right-arrow-32.png";

const HeroSection = () => {
  return (
    <section className="section-padding flex min-h-screen items-end pb-20 pt-32">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-end gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-primary">
              Intelligent Irrigation Systems
            </span>
          </div>
          <h1 className="font-display text-5xl leading-[1.05] tracking-[-0.01em] text-foreground sm:text-6xl lg:text-7xl xl:text-[84px]">
            Intelligent
            <br />
            <em>Irrigation.</em>
            <br />
            Zero Waste.
          </h1>
        </div>

        <div className="flex flex-col gap-10">
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            The AI-powered platform for leak detection, salinity control, and predictive resource
            allocation. Protect your soil and budget in real-time.
          </p>

          <div className="flex items-center gap-3">
            <a href="#" className="btn-ghost bg-accent text-accent-foreground">
              <img src={playIcon} alt="Play demo" className="h-5 w-5" />
              View Demo
            </a>
            <a href="#" className="btn-primary bg-accent text-accent-foreground hover:bg-accent">
              Get Started
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-foreground/20">
                <img src={rightArrowIcon} alt="Get started" className="h-5 w-5" />
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
