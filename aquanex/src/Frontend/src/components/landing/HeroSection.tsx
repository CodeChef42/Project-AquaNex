import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import rightArrowIcon from "@/assets/icons/icons8-right-arrow-32.png";
import landingpic from "@/assets/landingpic.png";
import landingpic2 from "@/assets/landingpic2.png";
import landingpicbreak from "@/assets/landingpicbreak.png";

const slides = [
  {
    image: landingpic,
    heading: "Intelligent Irrigation.",
    subheading: "Zero Waste.",
    body: "The AI-powered platform for leak detection, salinity control, and predictive resource allocation. Protect your soil and budget in real-time.",
  },
  {
    image: landingpicbreak,
    heading: "Detect Pipe Failures",
    subheading: "Before They Happen.",
    body: "ML-driven breakage prediction keeps your infrastructure running and your fields watered — automatically.",
  },
  {
    image: landingpic2,
    heading: "Real-Time Monitoring.",
    subheading: "Full Control.",
    body: "From soil sensors to cloud dashboards, AquaNex connects every node in your irrigation network.",
  },
];

const HeroSection = () => {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      goTo((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (indexFn: (prev: number) => number) => {
    setAnimating(true);
    setTimeout(() => {
      setCurrent(indexFn);
      setAnimating(false);
    }, 400);
  };

  const prev = () => goTo((c) => (c - 1 + slides.length) % slides.length);
  const next = () => goTo((c) => (c + 1) % slides.length);

  return (
    <section className="relative h-screen w-full overflow-hidden">

      {/* Images — cross-fade between slides */}
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={slide.image}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Text overlay */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-4">
          Intelligent Irrigation Systems
        </p>

        <div
          className={`min-h-[180px] flex flex-col items-center justify-center transition-opacity duration-400 ${
            animating ? "opacity-0" : "opacity-100"
          }`}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-2">
            {slides[current].heading}
          </h1>
          <h2 className="text-4xl md:text-6xl font-bold text-primary leading-tight mb-6">
            {slides[current].subheading}
          </h2>
          <p className="text-lg text-white/75 max-w-2xl mb-10">
            {slides[current].body}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 flex-wrap justify-center">
          <button
            onClick={() => navigate("/signin")}
            className="flex items-center gap-2 bg-transparent border border-white/40 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/10 transition"
          >
            View Demo
            <img src={rightArrowIcon} alt="" className="w-4 h-4 brightness-0 invert" />
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition shadow-lg"
          >
            Get Started
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex gap-3 mt-12">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setAnimating(true);
                setTimeout(() => {
                  setCurrent(i);
                  setAnimating(false);
                }, 400);
              }}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-8 h-2 bg-primary"
                  : "w-2 h-2 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Arrow buttons */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full transition"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full transition"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </section>
  );
};

export default HeroSection;
