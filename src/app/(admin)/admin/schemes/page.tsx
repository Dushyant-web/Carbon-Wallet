"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

type S = {
  slug: string;
  name: string;
  category: string;
  benefit: string;
  states: string;
  status: string;
  lastChecked: string;
  validUntil: string | null;
  link: string;
  sourceUrl: string;
  explained: number;
  applied: number;
};

const STATUS_CLS: Record<string, string> = { ACTIVE: "text-success-text", CHECK: "text-warning-text", HIDDEN: "text-ink-muted" };

export default function AdminSchemesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ schemes: S[] }>({
    queryKey: ["admin", "schemes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/schemes");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  async function patch(slug: string, body: Record<string, unknown>, done: string) {
    const res = await fetch(`/api/admin/schemes/${slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return toast.error("Couldn't save");
    toast.success(done);
    qc.invalidateQueries({ queryKey: ["admin", "schemes"] });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <span className="label-caps">Platform admin</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">Government schemes</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          The Sarkari Yojana catalogue households and shops see. Re-check each scheme on its official site regularly and press
          “Checked today”. Hide a scheme that has closed; “Check” shows households a note to confirm the terms.
        </p>
      </header>
      {isLoading || !data ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Scheme", "Benefit", "States", "Explained / applied", "Last checked", "Status", ""].map((h) => (
                  <th key={h} className="label-caps pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.schemes.map((s) => (
                <tr key={s.slug} className="border-b border-border/70 align-top">
                  <td className="py-3 pr-4">
                    <span className="font-medium">{s.name}</span>
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted underline">
                      official site <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="max-w-xs py-3 pr-4 text-[13px]">{s.benefit}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{s.states}</td>
                  <td className="py-3 pr-4 font-mono tabular-nums">{s.explained} / {s.applied}</td>
                  <td className="py-3 pr-4 text-xs">
                    {new Date(s.lastChecked).toLocaleDateString("en-IN")}
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-ink-muted underline">source</a>
                  </td>
                  <td className={`py-3 pr-4 font-mono text-[11px] uppercase ${STATUS_CLS[s.status] ?? ""}`}>{s.status}</td>
                  <td className="whitespace-nowrap py-3 text-right">
                    <button className="h-8 rounded-md border border-border px-3 text-xs hover:border-ink" onClick={() => patch(s.slug, { markChecked: true }, "Marked as checked today")}>
                      Checked today
                    </button>
                    <select
                      aria-label={`Status of ${s.name}`}
                      value={s.status}
                      onChange={(e) => patch(s.slug, { status: e.target.value }, "Status changed")}
                      className="ml-2 h-8 rounded-md border border-border bg-canvas-card px-2 text-xs"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="CHECK">Check</option>
                      <option value="HIDDEN">Hidden</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
