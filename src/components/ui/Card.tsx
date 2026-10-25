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
      ? "bg-primary text-canvas-card border-primary"
      : variant === "container"
      ? "bg-canvas-subtle border-border"
      : "bg-canvas-card border-border";

  return (
    <div className={`rounded-md border p-6 ${base} ${className}`} {...props}>
      {children}
    </div>
  );
}

/** Ruled section heading used across pages: "01 — Title" with an ink hairline. */
export function SectionHeading({
  index,
  title,
  meta,
  className = "",
}: {
  index?: string;
  title: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 border-t border-ink pt-2 ${className}`}>
      <div className="flex items-baseline gap-3">
        {index && <span className="font-mono text-[11px] text-ink-muted">{index}</span>}
        <h2 className="font-heading text-xl font-medium tracking-tight text-ink">{title}</h2>
      </div>
      {meta && <div className="label-caps">{meta}</div>}
    </div>
  );
}
