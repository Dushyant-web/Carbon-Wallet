"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Landmark, TriangleAlert, XCircle } from "lucide-react";
import type { ScanResult } from "@/server/services/merchant.service";

const TONE = {
  GREEN: { cls: "border-success-border bg-success-subtle text-success-text", Icon: CheckCircle2, word: "Green" },
  AMBER: { cls: "border-warning-border bg-warning-subtle text-warning-text", Icon: TriangleAlert, word: "Amber" },
  RED: { cls: "border-critical-border bg-critical-subtle text-critical-text", Icon: XCircle, word: "Red" },
} as const;

/**
 * After the scan: the home's colour with one sentence (never its numbers), and the government benefits that fit what
 * this shop sells. The shop is the bridge: it explains a scheme or helps apply, and the home gets the official link.
 */
export function CounterAdvice({ ticket, advice, disabled }: { ticket: string; advice: ScanResult["advice"]; disabled: boolean }) {
  const [done, setDone] = useState<Record<string, "EXPLAINED" | "APPLIED">>({});
  const tone = advice.status.colour ? TONE[advice.status.colour] : null;

  async function mark(slug: string, status: "EXPLAINED" | "APPLIED") {
    const res = await fetch("/api/merchant/schemes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket, slug, status }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? "Couldn't save");
    setDone((d) => ({ ...d, [slug]: status }));
    toast.success(status === "APPLIED" ? "Marked as applied. The customer gets the steps on their phone." : "Noted. The customer gets the details on their phone.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex items-start gap-3 border px-4 py-3 ${tone ? tone.cls : "border-border bg-canvas-subtle text-ink"}`}>
        {tone ? <tone.Icon className="mt-0.5 h-5 w-5 shrink-0" /> : null}
        <p className="text-[14px]">
          {tone && <strong className="mr-1">{tone.word}.</strong>}
          {advice.status.sentence}
        </p>
      </div>
      {advice.benefits.length > 0 && (
        <div className="border border-border bg-canvas-card">
          <p className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[14px] font-semibold">
            <Landmark className="h-4 w-4" /> Government benefits to tell the customer about
          </p>
          <ul>
            {advice.benefits.map((b) => (
              <li key={b.slug} className="border-b border-border px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">
                      {b.name}
                      {b.matched && <span className="ml-2 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success-text">fits this home</span>}
                    </p>
                    <p className="text-[13px] text-ink-muted">{b.benefit}</p>
                    {b.why && <p className="mt-0.5 text-[13px]">{b.why}</p>}
                    <a href={b.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] underline">
                      Official site <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {done[b.slug] ? (
                    <span className="flex items-center gap-1 text-[13px] font-semibold text-success-text">
                      <CheckCircle2 className="h-4 w-4" /> {done[b.slug] === "APPLIED" ? "Applied" : "Explained"}
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button disabled={disabled} onClick={() => mark(b.slug, "EXPLAINED")} className="h-9 rounded-md border border-border px-3 text-[12px] hover:border-ink disabled:opacity-40">
                        Explained
                      </button>
                      <button disabled={disabled} onClick={() => mark(b.slug, "APPLIED")} className="h-9 rounded-md bg-ink px-3 text-[12px] font-semibold text-canvas-card disabled:opacity-40">
                        Helped apply
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
