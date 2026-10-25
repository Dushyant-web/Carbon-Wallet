import React from "react";

export function EngineOffline() {
  return (
    <div className="border-l-2 border-warning bg-warning-subtle px-5 py-4 text-sm">
      <p className="font-semibold text-warning-text">Some numbers can&apos;t be worked out right now.</p>
      <p className="mt-1 text-ink-muted">Please try again in a minute.</p>
    </div>
  );
}
