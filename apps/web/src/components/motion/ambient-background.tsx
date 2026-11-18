"use client";

import { motion } from "framer-motion";
import { useMotionReducedPreference, useMotionVariants } from "./motion-provider";

export function AmbientBackground() {
  const reduceMotion = useMotionReducedPreference();
  const variants = useMotionVariants();

  return (
    <div className="ambient-layer" aria-hidden="true">
      <motion.div
        className="ambient-layer__aurora"
        variants={variants["bg-aurora-drift"]}
        initial="static"
        animate={reduceMotion ? "static" : "drift"}
      />
      <div className="ambient-layer__orbs">
        <span className="ambient-layer__orb ambient-layer__orb--one" />
        <span className="ambient-layer__orb ambient-layer__orb--two" />
        <span className="ambient-layer__orb ambient-layer__orb--three" />
        <span className="ambient-layer__orb ambient-layer__orb--four" />
      </div>
      <div className="ambient-layer__grid" />
      <div className="ambient-layer__grain" />
    </div>
  );
}
