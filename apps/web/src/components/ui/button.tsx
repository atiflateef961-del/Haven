"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  iconOnly?: boolean;
};

export type ButtonProps = ButtonBaseProps & (
  | { iconOnly?: false; "aria-label"?: string }
  | { iconOnly: true; "aria-label": string }
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel = "Loading",
      iconOnly = false,
      "aria-label": ariaLabel,
      disabled = false,
      type = "button",
      children,
      ...props
    },
    ref,
  ) {
    const classes = [
      "ui-button",
      `ui-button--${variant}`,
      `ui-button--${size}`,
      iconOnly ? "ui-button--icon-only" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-label={ariaLabel}
      >
        {loading ? (
          <span className="ui-button__spinner" aria-hidden="true" />
        ) : null}
        <span>{children}</span>
        {loading ? <span className="visually-hidden">{loadingLabel}</span> : null}
      </button>
    );
  },
);

Button.displayName = "Button";
