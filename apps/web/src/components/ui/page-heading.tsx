import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`page-heading${action ? " page-heading--with-action" : ""}${className ? ` ${className}` : ""}`}>
      <div className="page-heading__content">
        {eyebrow ? <p className="auth-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="page-heading__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="page-heading__action">{action}</div> : null}
    </header>
  );
}
