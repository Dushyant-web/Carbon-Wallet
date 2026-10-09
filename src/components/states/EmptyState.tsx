"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Layers } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-canvas-subtle/50 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary shadow-tier-1 mb-4 border border-border">
        {icon || <Layers className="h-6 w-6 text-slate-400" />}
      </div>
      <h3 className="font-heading text-base font-bold text-ink mb-1">
        {title}
      </h3>
      <p className="max-w-sm text-xs text-ink-muted leading-relaxed mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
