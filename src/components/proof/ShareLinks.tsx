"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StatementStatus } from "@/lib/engine";

type Share = { id: string; token: string; label: string | null; months: string[]; expiresAt: string; views: number; lastViewAt: string | null; state: "active" | "expired" | "revoked" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Owner/admin: share chosen sealed months with a bank or employer through a link that expires and can be turned off. */
export function ShareLinks({ householdId, demoRole, sealed }: { householdId: string; demoRole: string; sealed: StatementStatus[] }) {
  const qc = useQueryClient();
  const key = ["household", householdId, "shares", demoRole];
  const [months, setMonths] = useState<string[]>([]);
  const [days, setDays] = useState(30);
  const [label, setLabel] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { "content-type": "application/json", "x-demo-role": demoRole } });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? "Request failed");
    return out;
  };
  const { data } = useQuery<{ shares: Share[] }>({ queryKey: key, queryFn: () => call(`/api/households/${householdId}/shares`) });
  const create = useMutation({
    mutationFn: () => call(`/api/households/${householdId}/shares`, { method: "POST", body: JSON.stringify({ months, days, label: label || undefined }) }),
    onSuccess: () => {
      setError(null);
      setMonths([]);
      setLabel("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't create the link"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => call(`/api/households/${householdId}/shares/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const sealedMonths = sealed.filter((s) => s.anchored).map((s) => s.period);
  const url = (token: string) => `${origin}/verify/${token}`;
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(url(token));
      setCopied(token);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* the link is shown, so it can be copied by hand */
    }
  }

  return (
    <section className="border-t-2 border-ink pt-4">
      <h2 className="font-heading text-2xl font-medium">Share with a bank or employer</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Pick sealed months and send the link. They see your Carbon ID, city and those months&apos; totals, and can check each one
        against the public record themselves. Never your name, members, card or bills. Turn a link off any time.
      </p>

      {sealedMonths.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Seal a month above first; only sealed months can be shared.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {sealedMonths.map((m) => (
              <label key={m} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${months.includes(m) ? "border-ink bg-ink text-canvas" : "border-border hover:border-ink"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={months.includes(m)}
                  onChange={(e) => setMonths(e.target.checked ? [...months, m] : months.filter((x) => x !== m))}
                />
                {m}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="label-caps text-ink-muted">Who is it for (only you see this)</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. Home loan, SBI" className="h-10 w-64 rounded-md border border-border bg-canvas-card px-3" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="label-caps text-ink-muted">Works for</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-md border border-border bg-canvas-card px-3">
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
            <button
              onClick={() => create.mutate()}
              disabled={months.length === 0 || create.isPending}
              className="h-10 rounded-md bg-ink px-4 text-sm text-canvas disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create link"}
            </button>
          </div>
          {error && <p className="text-sm text-critical-text">{error}</p>}
        </div>
      )}

      {(data?.shares ?? []).length > 0 && (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {data!.shares.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {s.label || "Shared link"} · {s.months.join(", ")}
                </p>
                <p className="font-mono text-[11px] text-ink-muted">
                  {s.state === "active" ? `works until ${day(s.expiresAt)}` : s.state === "expired" ? "expired" : "turned off"} · viewed {s.views}{" "}
                  {s.views === 1 ? "time" : "times"}
                  {s.lastViewAt ? `, last ${day(s.lastViewAt)}` : ""}
                </p>
                {s.state === "active" && <p className="mt-1 truncate font-mono text-[11px] text-ink-light">{url(s.token)}</p>}
              </div>
              {s.state === "active" && (
                <div className="flex gap-2">
                  <button onClick={() => copy(s.token)} className="h-8 rounded-md border border-border px-3 text-xs hover:border-ink">
                    {copied === s.token ? "Copied ✓" : "Copy link"}
                  </button>
                  <button onClick={() => revoke.mutate(s.id)} className="h-8 rounded-md border border-border px-3 text-xs hover:border-critical hover:text-critical">
                    Turn off
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
