"use client";

import { MotionConfig, useReducedMotion } from "framer-motion";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createMotionVariants } from "@/lib/motion";

const ReducedMotionContext = createContext(true);

export function MotionProvider({ children }: { children: ReactNode }) {
  const userPreference = useReducedMotion();
  // Start in the safer static state until the browser preference is available.
  const reduceMotion = userPreference !== false;

  return (
    <ReducedMotionContext.Provider value={reduceMotion}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ReducedMotionContext.Provider>
  );
}

export function useMotionReducedPreference() {
  return useContext(ReducedMotionContext);
}

export function useMotionVariants() {
  const reduceMotion = useMotionReducedPreference();
  return useMemo(() => createMotionVariants(reduceMotion), [reduceMotion]);
}
