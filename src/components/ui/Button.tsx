import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "mint";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const sizeStyles = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm font-medium",
    lg: "h-11 px-5 text-base font-semibold",
  }[size];

  const variantStyles = {
    primary:
      "bg-primary text-white hover:bg-primary-hover border border-transparent shadow-tier-1",
    secondary:
      "bg-white text-ink border border-border hover:bg-canvas-subtle hover:border-border-hover shadow-tier-1",
    ghost:
      "bg-transparent text-ink-muted hover:bg-canvas-subtle hover:text-ink",
    destructive:
      "bg-critical text-white hover:bg-red-700 border border-transparent",
    mint:
      "bg-secondary-fixed text-primary font-bold hover:bg-white border border-secondary shadow-tier-1",
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
