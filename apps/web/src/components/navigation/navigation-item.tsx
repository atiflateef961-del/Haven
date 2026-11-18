import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

export type NavigationItemProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  current?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
};

export function NavigationItem({
  href,
  current = false,
  icon,
  badge,
  className = "",
  onKeyDown,
  children,
  ...props
}: NavigationItemProps) {
  const classes = ["ui-navigation__link", className].filter(Boolean).join(" ");

  return (
    <li className="ui-navigation__item">
      <Link
        {...props}
        href={href}
        className={classes}
        tabIndex={0}
        aria-current={current ? "page" : undefined}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && (event.key === " " || event.key === "Spacebar")) {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      >
        {icon ? (
          <span className="ui-navigation__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="ui-navigation__label">{children}</span>
        {badge !== undefined ? <span className="ui-navigation__badge">{badge}</span> : null}
      </Link>
    </li>
  );
}
