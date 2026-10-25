import React from "react";

/** A quiet "How is this worked out?" link that opens a plain-language explanation. Closed by default. */
export function HowCalculated({ children, label = "How is this worked out?", className = "" }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <details className={`group text-[12px] text-ink-muted ${className}`}>
      <summary className="inline cursor-pointer list-none underline decoration-dotted underline-offset-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="mt-1.5 max-w-2xl leading-relaxed">{children}</div>
    </details>
  );
}
