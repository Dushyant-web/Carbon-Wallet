"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";

type Setup = { bills: number; assets: number; committed: number; challenges: number };

/** Five steps that take a new home from empty to "proved", ticked from real data. Hidden once done or dismissed. */
export function GettingStarted({ setup, sealed }: { setup: Setup; sealed: boolean }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("cw-getting-started-hidden") === "1");
    } catch {
      /* storage blocked: just show it */
    }
  }, []);

  const steps = [
    { done: setup.bills > 0, title: "Upload an electricity bill", why: "We read the units for you; it becomes your real electricity number.", href: "/bills/new" },
    { done: setup.assets > 0, title: "Add your AC, appliances and vehicles", why: "Suggestions and estimates are sized to what you own.", href: "/assets" },
    { done: setup.committed > 0, title: "Commit to one suggestion", why: "Pick the biggest easy saving for your home.", href: "/actions" },
    { done: setup.challenges > 0, title: "Join a challenge", why: "A daily habit with streaks, points and badges.", href: "/challenges" },
    { done: sealed, title: "Lock and seal a month", why: "Proof anyone can check, shown on your Carbon ID.", href: "/proof" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;

  return (
    <section className="border border-ink bg-canvas-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="label-caps">Getting started · {doneCount} of {steps.length} done</span>
          <div className="mt-2 h-1.5 w-48 bg-canvas-subtle">
            <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
        </div>
        <button
          aria-label="Hide getting started"
          className="p-1 text-ink-light hover:text-ink"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem("cw-getting-started-hidden", "1");
            } catch {
              /* fine */
            }
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className={`group flex h-full flex-col gap-1 border p-3 transition-colors ${s.done ? "border-success-border bg-success-subtle/50" : "border-border hover:border-ink"}`}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${s.done ? "bg-success text-white" : "bg-ink text-canvas-card"}`}>
                  {s.done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s.title}
              </span>
              <span className="text-[11px] leading-snug text-ink-muted">{s.why}</span>
              {!s.done && (
                <span className="mt-auto flex items-center gap-1 pt-1 text-[11px] font-medium text-secondary">
                  Do it <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
