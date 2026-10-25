"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled client error in Carbon Wallet:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 shadow-tier-2 mb-4">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="font-heading text-2xl font-medium text-ink mb-2">
        Something went wrong
      </h1>
      <p className="max-w-md text-xs text-ink-muted leading-relaxed mb-6">
        An unexpected execution exception halted the current UI rendering pass. The underlying
        database and calculation pipeline remain protected and intact.
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={() => reset()}
        >
          Reload Interface
        </Button>
      </div>
    </div>
  );
}
