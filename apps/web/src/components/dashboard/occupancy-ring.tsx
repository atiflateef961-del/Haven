"use client";

import { useEffect, useRef } from "react";

export function OccupancyRing({ value }: { value: number | null }) {
  const arcRef = useRef<SVGCircleElement>(null);
  const safeValue = value === null ? 0 : Math.min(100, Math.max(0, value));

  useEffect(() => {
    const arc = arcRef.current;
    if (!arc) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetOffset = 100 - safeValue;
    if (reduceMotion) {
      arc.style.strokeDashoffset = String(targetOffset);
      return;
    }

    const duration = 900;
    let frame = 0;
    let startTime = 0;
    arc.style.strokeDashoffset = "100";

    const animate = (time: number) => {
      if (startTime === 0) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      arc.style.strokeDashoffset = String(100 - safeValue * eased);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [safeValue]);

  return (
    <div
      className="dashboard-occupancy-ring"
      role="img"
      aria-label={value === null ? "No active bed capacity" : `${value}% of active beds are occupied`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="dashboard-occupancy-ring__track" cx="50" cy="50" r="44" pathLength="100" />
        <circle ref={arcRef} className="dashboard-occupancy-ring__arc" cx="50" cy="50" r="44" pathLength="100" />
      </svg>
      <div className="dashboard-occupancy-ring__center">
        <strong>{value === null ? "N/A" : `${Math.round(value)}%`}</strong>
        <span>occupied</span>
      </div>
    </div>
  );
}
