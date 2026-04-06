import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import rightArrowIcon from "@/assets/icons/icons8-right-arrow-32.png";
import chevronDownIcon from "@/assets/icons/icons8-chevron-down-26.png";
import landingpic from "@/assets/landingpic.png";
import landingpic2 from "@/assets/landingpic2.png";
import landingpicbreak from "@/assets/landingpicbreak.png";
import { motion, AnimatePresence } from 'framer-motion';

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
    <section className="relative min-h-[100dvh] w-full overflow-hidden flex flex-col">

      {/* Images — cross-fade between slides */}
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <img src={slide.image} alt="" className="w-full h-full object-cover" />
        </div>
      ))}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Text overlay */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-20">

        {/* Badge — animates once on mount */}
        <motion.p
          className="text-[#86efac] font-bold text-xs md:text-sm uppercase tracking-[0.2em] mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Intelligent Irrigation Systems
        </motion.p>

        {/* Slide text — animates on slide change */}
        <div className="min-h-[220px] flex flex-col items-center justify-center max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-[1.1] mb-4">
                {slides[current].heading}
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-[#86efac] leading-[1.1] mb-8">
                {slides[current].subheading}
              </h2>
              <p className="text-base md:text-lg text-gray-200/90 leading-relaxed max-w-2xl mb-10 px-4">
                {slides[current].body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <button
            onClick={() => navigate("/signup")}
            className="flex h-12 w-full sm:w-auto items-center justify-center rounded-full bg-[#16a34a] px-8 text-sm font-bold text-white shadow-xl shadow-green-900/20 active:scale-95 transition-all md:h-14 md:text-base"
          >
            Get Started
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("features");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex h-12 w-full sm:w-auto items-center justify-center rounded-full border border-white/30 bg-white/10 px-8 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 active:scale-95 transition-all md:h-14 md:text-base"
          >
            Learn More
          </button>
        </motion.div>
      </div>

      {/* Progress indicators */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(() => i)}
            className={`h-1.5 transition-all duration-300 rounded-full ${
              i === current ? "w-8 bg-[#86efac]" : "w-2 bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
