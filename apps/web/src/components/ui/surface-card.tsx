import type { HTMLAttributes, ReactNode } from "react";

type SurfaceElement = "article" | "div" | "section";
type SurfacePadding = "none" | "sm" | "md" | "lg";

export type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  padding?: SurfacePadding;
  children: ReactNode;
};

export function SurfaceCard({
  as: Element = "div",
  padding = "md",
  className = "",
  children,
  ...props
}: SurfaceCardProps) {
  const classes = ["glass-surface", "ui-card", `ui-card--${padding}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Element {...props} className={classes}>
      {children}
    </Element>
  );
}
