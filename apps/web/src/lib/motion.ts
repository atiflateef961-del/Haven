import type { Variants } from "framer-motion";

export const motionEasings = {
  standard: [0.4, 0, 0.2, 1],
  emphasized: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.3, 0, 1, 1],
  spring: [0.5, 1.6, 0.5, 1],
} as const;

export const motionDurationsMs = {
  micro: 120,
  fast: 180,
  standard: 240,
  moderate: 320,
  slow: 420,
} as const;

const seconds = (milliseconds: number) => milliseconds / 1000;

function timing(milliseconds: number, ease: readonly number[], reduce: boolean) {
  return {
    duration: reduce ? 0 : seconds(milliseconds),
    ease: [...ease] as [number, number, number, number],
  };
}

function directionalVariants(
  reduce: boolean,
  axis: "x" | "y",
  distance: number,
  milliseconds: number,
  ease: readonly number[],
): Variants {
  return {
    hidden: { opacity: 0, ...(reduce ? {} : { [axis]: distance }) },
    visible: {
      opacity: 1,
      ...(reduce ? {} : { [axis]: 0 }),
      transition: timing(milliseconds, ease, reduce),
    },
    exit: {
      opacity: 0,
      ...(reduce ? {} : { [axis]: distance }),
      transition: timing(milliseconds, ease, reduce),
    },
  };
}

export function createMotionVariants(reduce: boolean) {
  const standard = motionEasings.standard;
  const decelerate = motionEasings.decelerate;
  const immediate = timing(120, decelerate, reduce);

  return {
    "fade-in": {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: timing(200, decelerate, reduce) },
      exit: { opacity: 0, transition: timing(120, standard, reduce) },
    },
    "fade-in-up": directionalVariants(reduce, "y", 8, 240, standard),
    "fade-in-down": directionalVariants(reduce, "y", -8, 240, standard),
    "scale-in": {
      hidden: { opacity: 0, ...(reduce ? {} : { scale: 0.96 }) },
      visible: {
        opacity: 1,
        ...(reduce ? {} : { scale: 1 }),
        transition: timing(220, motionEasings.emphasized, reduce),
      },
      exit: { opacity: 0, transition: immediate },
    },
    "slide-in-right": directionalVariants(reduce, "x", 24, 300, standard),
    "slide-in-left": directionalVariants(reduce, "x", -24, 300, standard),
    "stagger-container": {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: reduce ? 0 : 0.05,
          delayChildren: reduce ? 0 : 0.04,
        },
      },
    },
    "stagger-item": directionalVariants(reduce, "y", 8, 240, standard),
    "lift-on-hover": {
      rest: { y: 0 },
      hover: reduce ? { y: 0 } : { y: -2, transition: timing(180, standard, false) },
    },
    "press-down": {
      rest: { scale: 1 },
      press: reduce ? { scale: 1 } : { scale: 0.98, transition: timing(120, standard, false) },
    },
    shimmer: {
      initial: { opacity: 0.55 },
      animate: reduce
        ? { opacity: 0.55 }
        : { opacity: [0.45, 0.8, 0.45], transition: { duration: 1.5, ease: "linear", repeat: Infinity } },
    },
    "count-up": {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: timing(900, decelerate, reduce) },
    },
    "toast-in": directionalVariants(reduce, "x", 16, 300, motionEasings.decelerate),
    "toast-out": {
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, ...(reduce ? {} : { x: 16 }), transition: timing(180, motionEasings.accelerate, reduce) },
    },
    "page-transition": directionalVariants(reduce, "y", 8, 240, standard),
    "sidebar-expand": {
      collapsed: { scaleX: 0.28, originX: 0 },
      expanded: { scaleX: 1, originX: 0, transition: reduce ? immediate : { type: "spring", stiffness: 260, damping: 30 } },
    },
    "drawer-overlay": {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: timing(200, decelerate, reduce) },
      exit: { opacity: 0, transition: timing(160, motionEasings.accelerate, reduce) },
    },
    "accordion-expand": {
      collapsed: { scaleY: 0, opacity: 0, originY: 0 },
      expanded: { scaleY: 1, opacity: 1, originY: 0, transition: timing(280, standard, reduce) },
    },
    "tab-indicator": {
      inactive: { opacity: 0 },
      active: { opacity: 1, transition: reduce ? immediate : { type: "spring", stiffness: 380, damping: 32 } },
    },
    "checkbox-check": {
      unchecked: { pathLength: 0, opacity: 0 },
      checked: { pathLength: 1, opacity: 1, transition: timing(220, decelerate, reduce) },
    },
    "switch-toggle": {
      off: { x: 0 },
      on: { x: reduce ? 0 : 20, transition: reduce ? immediate : { type: "spring", stiffness: 500, damping: 30 } },
    },
    "status-pulse": {
      idle: { scale: 1, opacity: 1 },
      pulse: reduce
        ? { scale: 1, opacity: 1 }
        : { scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8], transition: { duration: 1.2, ease: "easeInOut", repeat: Infinity } },
    },
    "row-enter": directionalVariants(reduce, "y", 6, 200, decelerate),
    "skeleton-fade": {
      loading: { opacity: 1 },
      loaded: { opacity: 0, transition: timing(220, standard, reduce) },
    },
    "bg-aurora-drift": {
      static: { x: 0, y: 0, scale: 1 },
      drift: reduce
        ? { x: 0, y: 0, scale: 1 }
        : {
            x: ["-1%", "1%"],
            y: ["-0.5%", "0.5%"],
            scale: [1, 1.04],
            transition: { duration: 24, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" },
          },
    },
    "spinner-ring": {
      idle: { rotate: 0 },
      spin: reduce ? { rotate: 0 } : { rotate: 360, transition: { duration: 0.9, ease: "linear", repeat: Infinity } },
    },
    "progress-bar": {
      start: { scaleX: 0, originX: 0 },
      end: { scaleX: 1, originX: 0, transition: timing(600, decelerate, reduce) },
    },
    "number-flash": {
      idle: { color: "var(--text-primary)" },
      flash: {
        color: reduce ? "var(--text-primary)" : ["var(--accent-champagne)", "var(--text-primary)"],
        transition: timing(600, standard, reduce),
      },
    },
  } satisfies Record<string, Variants>;
}
