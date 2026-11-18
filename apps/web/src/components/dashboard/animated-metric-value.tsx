"use client";

import { useEffect, useRef } from "react";

/** Animates an existing dashboard total without changing its source value. */
export function AnimatedMetricValue({ value }: { value: number }) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = valueRef.current;
    if (!element) return;

    const formattedValue = (amount: number) => Math.round(amount).toLocaleString();
    const target = Number.isFinite(value) ? value : 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || target === 0) {
      element.textContent = formattedValue(target);
      return;
    }

    const duration = 900;
    let frame = 0;
    let startTime = 0;
    element.textContent = "0";

    const animate = (time: number) => {
      if (startTime === 0) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      element.textContent = formattedValue(target * eased);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <span ref={valueRef} aria-label={value.toLocaleString()}>{value.toLocaleString()}</span>;
}
