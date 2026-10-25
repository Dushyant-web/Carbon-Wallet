"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Card";

const STEPS = [
  ["Set up your household", "City, people, home type. Takes 30 seconds."],
  ["Add your AC and vehicles", "From the Assets page. The star label is enough."],
  ["Enter two electricity bills", "One winter, one summer. We measure what your AC really draws."],
  ["Read your statement", "kg CO₂ and ₹ by source, heat vs habit, and your biggest lever."],
  ["Commit and verify", "Commit to one action, then issue a statement anyone can verify."],
];

export function Welcome() {
  const { setCreateModalOpen, setActiveHouseholdId } = useAppStore();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't join with that code.");
      return;
    }
    setActiveHouseholdId(body.household.id);
    queryClient.invalidateQueries({ queryKey: ["households"] });
  }

  return (
    <div className="flex flex-col gap-12">
      <header>
        <span className="label-caps">Welcome</span>
        <h1 className="mt-2 font-heading text-4xl md:text-5xl font-medium tracking-tight">Let&apos;s set up your home</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Carbon Wallet works per household, because bills, ACs and cars are shared. Create one, or join your family&apos;s
          with the code from their Households page.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section>
          <SectionHeading index="A" title="Create a household" />
          <p className="mt-4 text-sm text-ink-muted">You become its owner and can invite others.</p>
          <Button className="mt-5" onClick={() => setCreateModalOpen(true)}>
            Create household
          </Button>
        </section>
        <section>
          <SectionHeading index="B" title="Join with a code" />
          <form onSubmit={join} className="mt-4 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SHARMA01"
              className="h-9 flex-1 rounded-sm border border-border bg-canvas-card px-3 font-mono text-sm uppercase focus:border-ink focus:outline-none"
            />
            <Button type="submit" variant="secondary" disabled={busy || code.trim().length < 4}>
              Join
            </Button>
          </form>
          {error && <p className="mt-2 font-mono text-xs text-critical-text">{error}</p>}
        </section>
      </div>

      <section>
        <SectionHeading index="→" title="What happens next" />
        <ol className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-6">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="border-t border-border pt-3">
              <span className="font-mono text-[11px] text-ink-muted">0{i + 1}</span>
              <p className="mt-1 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
