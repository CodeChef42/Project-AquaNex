import { useRef } from "react";
import { motion } from "framer-motion";
import rightArrowIcon from "@/assets/icons/icons8-right-arrow-32.png";

const CTASection = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <section id="contact" className="section-padding py-20 md:py-32">
      <motion.div
        ref={ref}
        className="mx-auto max-w-7xl rounded-[2rem] md:rounded-[3rem] bg-primary p-8 md:p-16 lg:p-20 relative overflow-hidden"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
      >
        {/* Background decorative element */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-64 h-64 md:w-96 md:h-96 rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10">
          <motion.h2
            className="font-display mb-6 max-w-2xl text-4xl leading-[1.1] text-primary-foreground md:text-5xl lg:text-7xl font-extrabold"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            Ready for Zero-Waste Irrigation?
          </motion.h2>

          <motion.p
            className="mb-10 max-w-lg text-base md:text-xl text-primary-foreground/80 leading-relaxed"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            Join the agricultural revolution. Protect your soil health, cut water costs, and future-proof your farm with AquaNex AI.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <a href="#" className="flex h-12 w-full sm:w-auto items-center justify-center gap-3 rounded-full bg-white px-8 text-sm font-bold text-primary shadow-xl active:scale-95 transition-all md:h-14 md:text-base">
              Schedule a Demo
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <img src={rightArrowIcon} alt="" className="h-3 w-3" />
              </div>
            </a>
            <button className="flex h-12 w-full sm:w-auto items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-md active:scale-95 transition-all md:h-14 md:text-base">
              Contact Sales
            </button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default CTASection;
