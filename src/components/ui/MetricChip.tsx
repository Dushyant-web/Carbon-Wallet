import React from "react";

export type ChipVariant = "positive" | "warning" | "critical" | "neutral";

interface MetricChipProps {
  label: string;
  variant?: ChipVariant;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricChip({
  label,
  variant = "neutral",
  icon,
  className = "",
}: MetricChipProps) {
  const variantStyles = {
    positive: "text-success-text border-success-border bg-success-subtle",
    warning: "text-warning-text border-warning-border bg-warning-subtle",
    critical: "text-critical-text border-critical-border bg-critical-subtle",
    neutral: "text-ink-muted border-border bg-canvas-subtle",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-[1px] font-mono text-[11px] font-medium tabular-nums ${variantStyles} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
