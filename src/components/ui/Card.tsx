import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "surface" | "container" | "dark";
}

export function Card({
  children,
  className = "",
  variant = "surface",
  ...props
}: CardProps) {
  const base =
    variant === "dark"
      ? "bg-primary text-white border-primary shadow-tier-2"
      : variant === "container"
      ? "bg-canvas-subtle border-border shadow-tier-1"
      : "bg-canvas-card border-border shadow-tier-1";

  return (
    <div
      className={`rounded-lg border p-6 transition-all ${base} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
