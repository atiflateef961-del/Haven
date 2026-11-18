import type { HTMLAttributes, ReactNode } from "react";

export type NavigationGroupProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  label: string;
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
};

export function NavigationGroup({
  label,
  orientation = "vertical",
  className = "",
  children,
  ...props
}: NavigationGroupProps) {
  const classes = ["ui-navigation", className].filter(Boolean).join(" ");

  return (
    <nav {...props} className={classes} aria-label={label} data-orientation={orientation}>
      <ul className="ui-navigation__list" role="list">
        {children}
      </ul>
    </nav>
  );
}
