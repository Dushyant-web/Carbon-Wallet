import React from "react";
import { MetricChip, ChipVariant } from "./MetricChip";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  deltaText?: string;
  deltaVariant?: ChipVariant;
  metaText?: string;
  className?: string;
}

export function KpiCard({
  label,
  value,
  unit,
  icon,
  deltaText,
  deltaVariant = "neutral",
  metaText,
  className = "",
}: KpiCardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-canvas-card p-5 shadow-tier-1 flex flex-col justify-between transition-all hover:border-border-hover ${className}`}
    >
      <div className="flex items-center justify-between text-ink-muted">
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-secondary">{icon}</span>}
      </div>

      <div className="my-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-ink tabular-nums font-heading">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-semibold text-ink-muted">
            {unit}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {deltaText && (
          <MetricChip label={deltaText} variant={deltaVariant} />
        )}
        {metaText && (
          <span className="text-[12px] text-ink-muted">
            {metaText}
          </span>
        )}
      </div>
    </div>
  );
}
