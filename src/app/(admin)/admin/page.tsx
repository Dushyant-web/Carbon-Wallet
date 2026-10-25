"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionHeading } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  status: string;
  lastLoginAt: string | null;
  canLogIn: boolean;
  households: number;
};

type Overview = {
  stats: { users: number; usersWithLogin: number; admins: number; households: number; activities: number };
  users: AdminUser[];
  audit: { id: string; at: string; action: string; details: string | null; user: string; household: string }[];
  deletions: {
    pending: { kind: "account" | "household"; name: string; requestedAt: string | null; eraseOn: string | null }[];
    erased: { id: string; at: string; users: number; households: number; statements: number; files: number }[];
  };
};

export default function AdminOverviewPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<Overview>({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error("Failed to load admin overview");
      return res.json();
    },
  });

  async function toggle(u: AdminUser) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: u.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <p className="text-sm text-critical-text">Couldn&apos;t load the admin overview.</p>;

  return (
    <div className="flex flex-col gap-12">
      <header>
        <span className="label-caps">Platform admin</span>
        <h1 className="mt-2 font-heading text-4xl md:text-5xl font-medium tracking-tight">Overview</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Accounts, households and recent activity across the platform. Document review and blockchain anchoring land
          here next.
        </p>
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-5 gap-8">
        <KpiCard label="Users" value={data.stats.users} metaText={`${data.stats.usersWithLogin} can log in`} />
        <KpiCard label="Admins" value={data.stats.admins} />
        <KpiCard label="Households" value={data.stats.households} metaText={<Link href="/admin/households" className="underline">Open directory</Link>} />
        <KpiCard label="Logged activities" value={data.stats.activities} />
        <KpiCard label="Grid factor" value="0.675" unit="kg/kWh" metaText="CEA v22.0" />
      </section>

      <section>
        <SectionHeading index="01" title="Users" meta="Disable signs a user out everywhere" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Name", "Email", "Role", "Households", "Last login", "Status", ""].map((h) => (
                  <th key={h} className="label-caps pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-border/70">
                  <td className="py-2.5 pr-4">{u.name}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{u.email}</td>
                  <td className="py-2.5 pr-4 font-mono text-[11px] uppercase">{u.platformRole}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{u.households}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-ink-muted">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-IN") : u.canLogIn ? "never" : "no password (invited)"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-mono text-[11px] uppercase ${u.status === "ACTIVE" ? "text-success-text" : "text-critical-text"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    {u.platformRole !== "ADMIN" && (
                      <button onClick={() => toggle(u)} className="text-xs underline text-ink-muted hover:text-ink">
                        {u.status === "ACTIVE" ? "Disable" : "Enable"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeading index="02" title="Data deletion" meta="Erased 30 days after the request · read-only" />
        <ul className="mt-4 flex flex-col">
          {(data.deletions?.pending ?? []).length === 0 && <li className="text-sm text-ink-muted">No pending deletions.</li>}
          {(data.deletions?.pending ?? []).map((d, i) => (
            <li key={i} className="grid grid-cols-[150px_1fr] gap-4 border-b border-border/70 py-2 text-sm">
              <span className="font-mono text-xs text-ink-muted">{d.eraseOn ? new Date(d.eraseOn).toLocaleDateString("en-IN") : "—"}</span>
              <span>
                {d.kind === "account" ? "Account" : "Household"} <span className="font-semibold">{d.name}</span> will be erased
              </span>
            </li>
          ))}
          {(data.deletions?.erased ?? []).map((e) => (
            <li key={e.id} className="grid grid-cols-[150px_1fr] gap-4 border-b border-border/70 py-2 text-sm text-ink-muted">
              <span className="font-mono text-xs">{new Date(e.at).toLocaleDateString("en-IN")}</span>
              <span>
                Erased {e.users} account{e.users === 1 ? "" : "s"}, {e.households} household{e.households === 1 ? "" : "s"}, {e.statements} sealed statement
                {e.statements === 1 ? "" : "s"} (no names kept)
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading index="03" title="Recent activity" meta="Audit log" />
        <ul className="mt-4 flex flex-col">
          {data.audit.length === 0 && <li className="text-sm text-ink-muted">Nothing yet.</li>}
          {data.audit.map((a) => (
            <li key={a.id} className="grid grid-cols-[150px_1fr] gap-4 border-b border-border/70 py-2 text-sm">
              <span className="font-mono text-xs text-ink-muted">{new Date(a.at).toLocaleString("en-IN")}</span>
              <span>
                <span className="font-semibold">{a.user}</span> · {a.household} · {a.details ?? a.action}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
