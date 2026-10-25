"use client";

import React, { useEffect, useState } from "react";
import type { ExtractedField } from "@/lib/bills";

export type Highlight = { key: string; label: string; colour: string; field: ExtractedField<unknown> };

/**
 * A bill page with boxes drawn where the engine read each number. Boxes are in normalised page
 * coordinates (0..1), so they scale with the image at any width.
 */
export function BillPreview({
  householdId,
  documentId,
  pageCount,
  highlights,
  active,
  onSelect,
}: {
  householdId: string;
  documentId: string;
  pageCount: number;
  highlights: Highlight[];
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Jump to the page holding the field the user is editing
  useEffect(() => {
    const h = highlights.find((x) => x.key === active);
    if (h?.field.page != null && h.field.page !== page && h.field.page < pageCount) {
      setPage(h.field.page);
      setLoaded(false);
    }
  }, [active, highlights, page, pageCount]);

  if (pageCount === 0) {
    return (
      <div className="flex aspect-[1/1.3] items-center justify-center border border-dashed border-border bg-canvas-subtle p-8 text-center text-sm text-ink-muted">
        No page preview: the original file has been deleted. The numbers below are what was read from it.
      </div>
    );
  }

  const onPage = highlights.filter((h) => h.field.bbox && h.field.page === page);

  return (
    <div className="flex flex-col gap-3">
      {pageCount > 1 && (
        <div className="flex gap-1" role="tablist" aria-label="Bill pages">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === page}
              onClick={() => {
                setPage(i);
                setLoaded(false);
              }}
              className={`h-7 min-w-7 border px-2 font-mono text-xs ${i === page ? "border-ink bg-ink text-canvas-card" : "border-border text-ink-muted hover:border-ink"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
      <div className="relative overflow-hidden border border-border bg-white shadow-tier-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated PNG; next/image would cache it */}
        <img
          src={`/api/households/${householdId}/documents/${documentId}/preview/${page}`}
          alt={`Bill page ${page + 1}`}
          className={`block w-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
        />
        {!loaded && <div className="absolute inset-0 animate-pulse bg-canvas-subtle" />}
        {loaded &&
          onPage.map((h) => {
            const [x0, y0, x1, y1] = h.field.bbox!;
            const isActive = active === h.key;
            return (
              <button
                key={h.key}
                type="button"
                onClick={() => onSelect(h.key)}
                title={`${h.label}: ${h.field.snippet ?? ""}`}
                aria-label={`Show ${h.label}`}
                className="absolute transition-all duration-200"
                style={{
                  left: `${(x0 * 100).toFixed(2)}%`,
                  top: `${(y0 * 100).toFixed(2)}%`,
                  width: `${((x1 - x0) * 100).toFixed(2)}%`,
                  height: `${((y1 - y0) * 100).toFixed(2)}%`,
                  outline: `${isActive ? 3 : 2}px solid ${h.colour}`,
                  outlineOffset: 2,
                  background: `${h.colour}${isActive ? "33" : "1a"}`,
                }}
              >
                {isActive && (
                  <span
                    className="absolute -top-5 left-0 whitespace-nowrap px-1 font-mono text-[10px] leading-4 text-white"
                    style={{ background: h.colour }}
                  >
                    {h.label}
                  </span>
                )}
              </button>
            );
          })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {highlights
          .filter((h, i, all) => all.findIndex((x) => x.colour === h.colour) === i)
          .map((h) => (
            <span key={h.key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span className="h-2.5 w-2.5" style={{ outline: `2px solid ${h.colour}`, background: `${h.colour}1a` }} />
              {h.key === "prev" || h.key === "present" ? "Meter readings" : h.key === "import" || h.key === "export" ? "Solar import / export" : h.label}
            </span>
          ))}
      </div>
      <p className="text-[11px] leading-snug text-ink-muted">
        Boxes show exactly where each number was read. Click a box or a field to match them up.
      </p>
    </div>
  );
}
