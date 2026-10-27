"use client";

import { Pager, usePaged } from "@/components/ui/Pager";
import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionHeading } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { MERCHANT_STATUS_LABEL, SELLS } from "@/lib/merchant";
import { labelOf } from "@/lib/assets";

type AdminMerchant = {
  id: string;
  businessName: string;
  gstin: string | null;
  city: string;
  state: string;
  sells: string;
  status: string;
  contact: { name: string; email: string; accountStatus: string };
  createdAt: string;
  reviewedAt: string | null;
  registered: number;
  rejected: number;
};

const btn = "h-8 rounded-md border border-border bg-canvas-card px-3 text-xs font-medium hover:border-ink";
const STATUS_CLS: Record<string, string> = { PENDING: "text-warning-text", APPROVED: "text-success-text", SUSPENDED: "text-critical-text" };

export default function AdminMerchantsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<{ merchants: AdminMerchant[] }>({
    queryKey: ["admin", "merchants"],
    queryFn: async () => {
      const res = await fetch("/api/admin/merchants");
      if (!res.ok) throw new Error("Failed to load shops");
      return res.json();
    },
  });

  const shops = usePaged(data?.merchants ?? []);

  async function setStatus(m: AdminMerchant, status: "APPROVED" | "SUSPENDED") {
    const res = await fetch(`/api/admin/merchants/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["admin", "merchants"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    }
  }

  // "no data and no error yet" is loading too: that is what the server renders, so the first paint matches
  if (isLoading || (!data && !error)) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <p className="text-sm text-critical-text">Couldn&apos;t load the shops.</p>;
  const pending = data.merchants.filter((m) => m.status === "PENDING").length;

  return (
    <div className="flex flex-col gap-12">
      <header>
        <span className="label-caps">Platform admin</span>
        <h1 className="mt-2 font-heading text-4xl md:text-5xl font-medium tracking-tight">Shops</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Shops that sell appliances or vehicles scan a customer&apos;s Carbon Card and register what they bought onto that
          home. Check a shop (name, GSTIN, city) before approving it. Owners can turn down items that aren&apos;t theirs; a shop
          with many turned down is worth a look, and suspending it stops its scans at once.
        </p>
      </header>

      <section>
        <SectionHeading index="01" title={`${data.merchants.length} shops`} meta={pending ? `${pending} waiting for approval` : undefined} />
        {data.merchants.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No shops have registered yet. They sign up at /merchant/signup.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Shop", "GSTIN", "Sells", "Contact", "Items", "Turned down", "Status", ""].map((h) => (
                    <th key={h} className="label-caps pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shops.slice.map((m) => (
                  <tr key={m.id} className="border-b border-border/70 align-top">
                    <td className="py-2.5 pr-4">
                      {m.businessName}
                      <span className="block text-[11px] text-ink-muted">
                        {m.city}, {m.state} · since {new Date(m.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{m.gstin ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-xs">{labelOf(SELLS, m.sells)}</td>
                    <td className="py-2.5 pr-4">
                      {m.contact.name}
                      <span className="block font-mono text-[11px] text-ink-muted">{m.contact.email}</span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">{m.registered}</td>
                    <td className={`py-2.5 pr-4 font-mono tabular-nums ${m.rejected ? "text-critical-text" : ""}`}>{m.rejected}</td>
                    <td className={`py-2.5 pr-4 font-mono text-[11px] uppercase ${STATUS_CLS[m.status] ?? ""}`}>
                      {MERCHANT_STATUS_LABEL[m.status] ?? m.status}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {m.status !== "APPROVED" && (
                        <button className={btn} onClick={() => setStatus(m, "APPROVED")}>
                          {m.status === "PENDING" ? "Approve" : "Reinstate"}
                        </button>
                      )}
                      {m.status !== "SUSPENDED" && (
                        <button className={`${btn} ml-2 hover:text-critical-text`} onClick={() => setStatus(m, "SUSPENDED")}>
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={shops.page} pages={shops.pages} total={shops.total} onPage={shops.setPage} />
          </div>
        )}
      </section>
    </div>
  );
}
