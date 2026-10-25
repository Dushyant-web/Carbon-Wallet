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
    md: "h-9 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
  }[size];

  const variantStyles = {
    primary: "bg-primary text-primary-foreground border border-primary hover:bg-primary-hover",
    secondary: "bg-canvas-card text-ink border border-border hover:border-ink",
    ghost: "bg-transparent text-ink-muted border border-transparent hover:text-ink hover:bg-canvas-subtle",
    destructive: "bg-critical text-white border border-critical hover:bg-critical-text",
    // Kept for API compatibility: the accent action on dark surfaces
    mint: "bg-secondary text-white border border-secondary hover:bg-secondary-hover",
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-100 disabled:opacity-45 disabled:cursor-not-allowed ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
