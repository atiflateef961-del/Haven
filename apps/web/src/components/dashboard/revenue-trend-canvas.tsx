"use client";

import { useEffect, useRef } from "react";
import { SurfaceCard } from "@/components/ui/surface-card";

type RevenuePoint = { label: string; amount: number };

export function RevenueTrendCanvas({ points }: { points: RevenuePoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const container = canvas?.parentElement;
    if (!canvas || !context || !container || points.length < 2) return;

    const draw = () => {
      const width = Math.max(1, container.clientWidth);
      const height = 220;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const accent = getComputedStyle(canvas).getPropertyValue("--accent").trim() || "#a0522d";
      const grid = getComputedStyle(canvas).getPropertyValue("--border-subtle").trim() || "#d8d2c4";
      const padding = { top: 12, right: 12, bottom: 22, left: 12 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const max = Math.max(...points.map((point) => point.amount)) * 1.08;
      const coords = points.map((point, index) => ({
        x: padding.left + index / (points.length - 1) * chartWidth,
        y: padding.top + chartHeight - point.amount / max * chartHeight,
      }));

      context.strokeStyle = grid;
      context.lineWidth = 1;
      for (let index = 0; index < 4; index += 1) {
        const y = padding.top + chartHeight * index / 3;
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
      }

      const gradient = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
      gradient.addColorStop(0, accent);
      gradient.addColorStop(1, accent);
      context.beginPath();
      coords.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
      context.lineTo(coords.at(-1)!.x, height - padding.bottom);
      context.lineTo(coords[0].x, height - padding.bottom);
      context.closePath();
      context.globalAlpha = 0.16;
      context.fillStyle = gradient;
      context.fill();
      context.globalAlpha = 1;

      context.beginPath();
      coords.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
      context.strokeStyle = accent;
      context.lineWidth = 2.5;
      context.lineJoin = "round";
      context.stroke();
      context.fillStyle = accent;
      coords.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 3, 0, Math.PI * 2);
        context.fill();
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [points]);

  const maxAmount = Math.max(...points.map((point) => point.amount));
  return (
    <SurfaceCard as="section" className="dashboard-panel dashboard-revenue-trend" padding="lg" aria-labelledby="dashboard-revenue-trend-title">
      <div className="dashboard-panel__heading">
        <div><p className="dashboard-panel__eyebrow">PAST SIX MONTHS · PKR</p><h2 id="dashboard-revenue-trend-title">Revenue trend</h2></div>
        <span className="dashboard-period">Live demo series</span>
      </div>
      <div className="dashboard-revenue-trend__plot">
        <div className="dashboard-revenue-trend__axis" aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => <span key={fraction}>PKR {Math.round(maxAmount * fraction / 1000).toLocaleString()}k</span>)}
        </div>
        <canvas ref={canvasRef} data-points={points.length} role="img" aria-label={`Six-month revenue trend with ${points.length} monthly values`} />
      </div>
      <div className="dashboard-revenue-trend__labels" aria-hidden="true">{points.map((point) => <span key={point.label}>{point.label}</span>)}</div>
      <p className="visually-hidden">{points.map((point) => `${point.label}: PKR ${point.amount.toLocaleString()}`).join(". ")}</p>
    </SurfaceCard>
  );
}
