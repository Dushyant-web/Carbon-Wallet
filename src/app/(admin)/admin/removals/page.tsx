"use client";

import { Pager, usePaged } from "@/components/ui/Pager";
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";

type Req = {
  id: string;
  kind: string;
  itemSummary: string;
  shopName: string | null;
  reason: string;
  note: string;
  status: string;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  photoIds: string[];
  household: { id: string; name: string; city: string; carbonId: string | null; requestsEver: number; recentBills: { month: string; kwh: number }[] };
};

const REASON: Record<string, string> = {
  BROKEN: "Broken",
  SOLD: "Sold",
  GIVEN_AWAY: "Given away",
  SCRAPPED: "Scrapped",
  NEVER_HAD: "Never had it",
  NOT_OURS: "Not ours (dispute against the shop)",
};
const TABS = ["PENDING", "APPROVED", "REJECTED"] as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminRemovalsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("PENDING");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<{ requests: Req[] }>({
    queryKey: ["admin", "removals", tab],
    queryFn: async () => {
      const res = await fetch(`/api/admin/removals?status=${tab}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const list = usePaged(data?.requests ?? []);

  async function decide(r: Req, decision: "APPROVE" | "REJECT") {
    const note = notes[r.id]?.trim();
    if (decision === "REJECT" && !note) return toast.error("Write a line for the owner: why it stays.");
    const res = await fetch(`/api/admin/removals/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note: note || undefined }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? "Couldn't save the decision");
    toast.success(decision === "APPROVE" ? `Removed: ${r.itemSummary}` : "Rejected. The owner has been told why.");
    qc.invalidateQueries({ queryKey: ["admin", "removals"] });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <span className="label-caps">Platform admin</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">Removal requests</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Households can&apos;t delete items. They ask here with photos and a short note. Check the photos match the item, and
          whether the bills dropped after the date. “Not ours” is a dispute against the shop that registered it: approving it
          counts against that shop.
        </p>
      </header>

      <div role="tablist" className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px h-11 border-b-[3px] px-4 text-sm ${tab === t ? "border-secondary font-semibold" : "border-transparent text-ink-muted"}`}>
            {t === "PENDING" ? "Waiting" : t === "APPROVED" ? "Approved" : "Rejected"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : error || !data ? (
        <p className="text-sm text-critical-text">Couldn&apos;t load requests.</p>
      ) : data.requests.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.slice.map((r) => {
            const bills = r.household.recentBills;
            const maxKwh = Math.max(1, ...bills.map((b) => b.kwh));
            return (
              <li key={r.id} className="grid grid-cols-1 gap-5 border border-border bg-canvas-card p-5 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="label-caps">{r.kind === "APPLIANCE" ? "Appliance" : "Vehicle"} · asked {when(r.createdAt)}</p>
                  <p className="mt-1 text-lg font-semibold">{r.itemSummary}</p>
                  <p className="text-sm text-ink-muted">
                    {r.household.name}, {r.household.city} · <span className="font-mono">{r.household.carbonId}</span> · {r.household.requestsEver} request{r.household.requestsEver === 1 ? "" : "s"} ever
                  </p>
                  {r.shopName && <p className="text-sm text-ink-muted">Registered by {r.shopName}</p>}
                  <p className={`mt-3 text-sm font-semibold ${r.reason === "NOT_OURS" ? "text-critical-text" : ""}`}>{REASON[r.reason] ?? r.reason}</p>
                  <p className="mt-1 border-l-2 border-border pl-3 text-[15px]">“{r.note}”</p>
                  {r.photoIds.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.photoIds.map((pid) => {
                        const src = `/api/admin/removals/${r.id}/photos/${pid}`;
                        return (
                          <button key={pid} onClick={() => setZoom(src)} className="h-28 w-28 overflow-hidden border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="Evidence photo" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] text-ink-muted">No photos (not needed for this reason).</p>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <p className="label-caps">Last bills (units)</p>
                    {bills.length === 0 ? (
                      <p className="mt-2 text-[13px] text-ink-muted">No bills to compare.</p>
                    ) : (
                      <div className="mt-2 flex h-24 items-end gap-2 border-b border-ink">
                        {bills.map((b) => (
                          <div key={b.month} className="flex flex-1 flex-col items-center justify-end">
                            <span className="text-[11px] tabular-nums">{Math.round(b.kwh)}</span>
                            <div className="w-full bg-ink/70" style={{ height: `${(b.kwh / maxKwh) * 70}%` }} />
                            <span className="mt-1 font-mono text-[10px] text-ink-muted">{b.month.slice(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {r.status === "PENDING" ? (
                    <>
                      <textarea
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value.slice(0, 240) })}
                        rows={2}
                        placeholder="Note to the owner (needed to reject)"
                        className="w-full rounded-sm border border-border p-2 text-sm focus:border-ink focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => decide(r, "APPROVE")} className="h-10 flex-1 rounded-md bg-success px-4 text-sm font-semibold text-white">Approve: remove item</button>
                        <button onClick={() => decide(r, "REJECT")} className="h-10 flex-1 rounded-md border border-critical px-4 text-sm font-semibold text-critical-text">Reject</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm">
                      {r.status === "APPROVED" ? "Approved" : "Rejected"} {r.decidedAt ? when(r.decidedAt) : ""}
                      {r.decisionNote && <span className="block text-ink-muted">“{r.decisionNote}”</span>}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={list.page} pages={list.pages} total={list.total} onPage={list.setPage} />

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6" onClick={() => setZoom(null)} role="dialog" aria-label="Photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Evidence photo, large" className="max-h-full max-w-full" />
        </div>
      )}
    </div>
  );
}
