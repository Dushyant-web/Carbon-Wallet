"use client";

import React from "react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

/** A quiet "How is this worked out?" link that opens a plain-language explanation. Closed by default. */
export function HowCalculated({ children, label, className = "" }: { children: React.ReactNode; label?: string; className?: string }) {
  const { t } = useUiPrefs();
  label ??= t("How is this worked out?", "यह कैसे निकाला?");
  return (
    <details className={`group text-[12px] text-ink-muted ${className}`}>
      <summary className="inline cursor-pointer list-none underline decoration-dotted underline-offset-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="mt-1.5 max-w-2xl leading-relaxed">{children}</div>
    </details>
  );
}
