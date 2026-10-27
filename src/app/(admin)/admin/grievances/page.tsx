"use client";

import { Pager, usePaged } from "@/components/ui/Pager";
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";

type Ticket = {
  id: string;
  ticket: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  response: string | null;
  createdAt: string;
  from: { name: string; email: string; platformRole: string } | null;
};

export default function AdminGrievancesPage() {
  const [status, setStatus] = useState("OPEN");
  const [reply, setReply] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ tickets: Ticket[] }>({
    queryKey: ["admin", "grievances", status],
    queryFn: async () => (await fetch(`/api/admin/grievances?status=${status}`)).json(),
  });

  const list = usePaged(data?.tickets ?? []);

  async function answer(tk: Ticket, next: "IN_PROGRESS" | "RESOLVED") {
    const res = await fetch(`/api/admin/grievances/${tk.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next, response: reply[tk.id] ?? "" }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? "Couldn't save");
    toast.success(`${tk.ticket}: ${next === "RESOLVED" ? "resolved" : "marked in progress"}; the person is notified`);
    qc.invalidateQueries({ queryKey: ["admin", "grievances"] });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <span className="label-caps">Platform admin</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">Complaints</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">Every ticket gets a written reply. Aim to answer within two working days; oldest first.</p>
      </header>
      <div role="tablist" className="flex gap-1 border-b border-border">
        {[
          ["OPEN", "New"],
          ["IN_PROGRESS", "In progress"],
          ["RESOLVED", "Resolved"],
        ].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} onClick={() => setStatus(v)} className={`-mb-px h-11 border-b-[3px] px-4 text-sm ${status === v ? "border-gov-saffron font-semibold" : "border-transparent text-ink-muted"}`}>
            {l}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data?.tickets.length ? (
        <p className="text-sm text-ink-muted">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.slice.map((tk) => (
            <li key={tk.id} className="grid grid-cols-1 gap-4 border border-border bg-canvas-card p-5 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <p className="font-mono text-[12px] font-semibold text-gov-blue">
                  {tk.ticket} · {tk.category}
                </p>
                <p className="mt-1 text-lg font-semibold">{tk.subject}</p>
                <p className="text-[12px] text-ink-muted">
                  {tk.from ? `${tk.from.name} · ${tk.from.email} · ${tk.from.platformRole.toLowerCase()}` : "—"} · {new Date(tk.createdAt).toLocaleString("en-IN")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[14px]">{tk.message}</p>
              </div>
              <div className="flex flex-col gap-2">
                {tk.response && <p className="border-l-4 border-gov-navy bg-gov-sky px-3 py-2 text-[13px]">{tk.response}</p>}
                {tk.status !== "RESOLVED" && (
                  <>
                    <textarea
                      rows={3}
                      value={reply[tk.id] ?? ""}
                      onChange={(e) => setReply({ ...reply, [tk.id]: e.target.value })}
                      placeholder="Reply to the person (they see this)"
                      className="rounded-sm border border-border p-2 text-sm focus:border-ink focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => answer(tk, "IN_PROGRESS")} className="h-10 flex-1 rounded-md border border-gov-navy text-sm font-semibold text-gov-navy">
                        Reply · in progress
                      </button>
                      <button onClick={() => answer(tk, "RESOLVED")} className="h-10 flex-1 rounded-md bg-success text-sm font-semibold text-white">
                        Reply · resolved
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager page={list.page} pages={list.pages} total={list.total} onPage={list.setPage} />
    </div>
  );
}
