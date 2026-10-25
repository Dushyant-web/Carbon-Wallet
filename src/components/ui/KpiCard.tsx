import React from "react";
import { MetricChip, ChipVariant } from "./MetricChip";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  deltaText?: string;
  deltaVariant?: ChipVariant;
  metaText?: React.ReactNode;
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
      className={`flex flex-col justify-between border-t border-ink bg-transparent pt-3 pb-1 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        {icon && <span className="text-ink-light">{icon}</span>}
      </div>

      <div className="mt-3 mb-3 flex items-baseline gap-1.5">
        <span className="font-heading text-[2.6rem] leading-none font-medium tracking-tight text-ink tabular-nums">
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-ink-muted">{unit}</span>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {deltaText && <MetricChip label={deltaText} variant={deltaVariant} />}
        {metaText && <span className="text-xs text-ink-muted">{metaText}</span>}
      </div>
    </div>
  );
}
