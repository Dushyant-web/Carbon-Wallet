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
    positive: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]",
    warning: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
    critical: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
    neutral: "bg-[#F1F5F9] text-[#334155] border-[#E2E8F0]",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border tabular-nums ${variantStyles} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
