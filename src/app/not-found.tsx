import React from "react";
import Link from "next/link";
import { Leaf, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-tertiary shadow-tier-2 mb-4">
        <Leaf className="h-7 w-7" />
      </div>
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-secondary mb-1">
        404 Resource Not Found
      </span>
      <h1 className="font-heading text-3xl font-bold text-ink mb-2">
        Telemetry Node Unmapped
      </h1>
      <p className="max-w-md text-xs text-ink-muted leading-relaxed mb-6">
        The requested routing domain does not map to any active CarbonOS intelligence telemetry or household registry endpoint.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-tier-1 hover:bg-emerald-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Executive Overview</span>
      </Link>
    </div>
  );
}
