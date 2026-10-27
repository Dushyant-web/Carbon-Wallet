"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdActivities } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryColor } from "@/lib/viz";

const FILTERS = [
  ["all", "Everything"],
  ["Electricity", "Electricity"],
  ["Transport", "Car & bike"],
  ["Travel", "Trips & flights"],
  ["Cooking", "Cooking gas"],
  ["Refrigerant", "AC gas refills"],
] as const;

// Where each entry came from, in words
const SOURCE: Record<string, string> = {
  MANUAL: "You logged it",
  BILL_IMPORT: "From your bill",
  SMART_METER: "Meter reading",
  RECURRING: "Repeats monthly",
  FUEL_PHOTO: "Fuel fill-up",
};

type Row = {
  id: string;
  type: string;
  category: string;
  quantity: number;
  unit: string;
  occurredOn: string;
  source: string;
  notes?: string | null;
  billId?: string | null;
  coveredByBillId?: string | null;
  emissionEvents?: Array<{ kgCo2e: number; factor: { kgCo2ePerUnit: number; unit: string } }>;
};

const nice = (t: string) => t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function ActivitiesPage() {
  const { activeHouseholdId, setLogModalOpen } = useAppStore();
  const [filterCat, setFilterCat] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const { data, isLoading } = useHouseholdActivities(activeHouseholdId, filterCat, page, pageSize);
  const { can } = usePermissions();

  const activities: Row[] = data?.activities || [];
  const total = data?.total || activities.length;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        section="Your home"
        title="Activity log"
        what="A list of everything that added CO₂ for your home: bills, car trips, flights, food and waste, each with how it was calculated."
        doThis="Add anything a bill doesn't cover, like a trip or a flight, with “Add an entry”."
        get="A complete record. Hover over any CO₂ number to see how it was worked out."
        actions={
          can("activity:create") ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setLogModalOpen(true)}>
              Add an entry
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by category">
          {FILTERS.map(([v, l]) => (
            <button
              key={v}
              role="tab"
              aria-selected={filterCat === v}
              onClick={() => {
                setFilterCat(v);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${filterCat === v ? "border-ink bg-ink text-canvas-card" : "border-border text-ink-muted hover:border-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-muted">{total} entries</span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="border border-dashed border-border px-6 py-12 text-center text-sm text-ink-muted">Nothing here yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="label-caps pb-2 font-medium">Date</th>
                <th className="label-caps pb-2 font-medium">What</th>
                <th className="label-caps pb-2 text-right font-medium">Amount</th>
                <th className="label-caps pb-2 text-right font-medium">CO₂e</th>
                <th className="label-caps pb-2 pl-6 font-medium">Where it came from</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => {
                const ev = a.emissionEvents?.[0];
                const covered = !!a.coveredByBillId;
                return (
                  <tr key={a.id} className={`border-b border-border/70 ${covered ? "text-ink-light" : ""}`}>
                    <td className="py-3 pr-3 whitespace-nowrap font-mono text-xs text-ink-muted">
                      {new Date(a.occurredOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0" style={{ backgroundColor: categoryColor(a.category) }} />
                        {a.notes || nice(a.type)}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {a.quantity} {a.unit}
                    </td>
                    <td
                      className={`py-3 text-right font-mono tabular-nums ${covered ? "line-through" : "font-semibold"}`}
                      title={ev ? `${a.quantity} ${a.unit} × ${ev.factor.kgCo2ePerUnit} kg per ${ev.factor.unit}` : undefined}
                    >
                      {ev ? `${ev.kgCo2e} kg` : "—"}

                    </td>
                    <td className="py-3 pl-6 text-xs">
                      {covered ? (
                        <span title="This is already inside an electricity bill, so it isn't counted twice">Counted in your bill</span>
                      ) : (
                        <span className="text-ink-muted">{SOURCE[a.source] ?? nice(a.source.toLowerCase())}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} icon={<ChevronLeft className="h-4 w-4" />}>
              Newer
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} icon={<ChevronRight className="h-4 w-4" />}>
              Older
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
