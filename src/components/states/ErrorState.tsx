"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred while loading this page.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-12 text-center rounded-xl border border-rose-200 bg-rose-50/30 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-tier-1 mb-4 border border-rose-200">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="font-heading text-base font-medium text-ink mb-1">
        {title}
      </h3>
      <p className="max-w-sm text-xs text-ink-muted leading-relaxed mb-6">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={onRetry}
        >
          Retry Connection
        </Button>
      )}
    </div>
  );
}
