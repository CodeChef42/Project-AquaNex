import { useRef } from "react";
import { motion } from "framer-motion";
import rightArrowIcon from "@/assets/icons/icons8-right-arrow-32.png";

const CTASection = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <section id="contact" className="section-padding py-24">
      <motion.div
        ref={ref}
        className="mx-auto max-w-7xl rounded-3xl bg-primary p-10 md:p-16"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
      >
        <motion.h2
          className="font-display mb-6 max-w-lg text-4xl leading-[1.1] text-primary-foreground md:text-5xl lg:text-6xl"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          Ready for Zero-Waste Irrigation?
        </motion.h2>

        <motion.p
          className="mb-10 max-w-md text-lg text-primary-foreground/70"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          See how AquaNex AI platform can cut water waste and protect your farm&apos;s future.
          Schedule a live demo.
        </motion.p>

        <motion.div
          className="flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <a href="#" className="btn-pill bg-[#16a34a] text-accent-foreground">
            Get Started
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-foreground/20">
              <img src={rightArrowIcon} alt="Get started" className="h-5 w-5" />
            </div>
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default CTASection;
