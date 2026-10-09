"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store";
import { useHouseholdActivities } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { LogActivityModal } from "@/components/dashboard/LogActivityModal";
import { Receipt, Plus, Filter, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";

export default function ActivitiesPage() {
  const { activeHouseholdId, setLogModalOpen } = useAppStore();
  const [filterCat, setFilterCat] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = useHouseholdActivities(activeHouseholdId, filterCat, page, pageSize);
  const { can } = usePermissions();

  const activities = data?.activities || [];
  const total = data?.total || activities.length;
  const totalPages = data?.totalPages || 1;
  const canCreate = can("activity:create");

  const handleFilterChange = (cat: string) => {
    setFilterCat(cat);
    setPage(1);
  };

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-secondary" />
            <h1 className="font-heading text-2xl font-bold text-ink">
              Carbon Activity Ledger
            </h1>
          </div>
          <p className="text-xs text-ink-muted">
            Continuous activity transactions, smart meter events, and verified calculations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setLogModalOpen(true)}
            disabled={!canCreate}
          >
            {canCreate ? "Log Activity Event" : "Log Activity (Locked)"}
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Table Filter Rail */}
        <div className="flex flex-wrap items-center justify-between border-b border-border bg-canvas-subtle p-4 gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-muted" />
            <select
              value={filterCat}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-ink outline-none"
            >
              <option value="all">All Domains (Electricity, Transport, Travel, Food, Waste)</option>
              <option value="Electricity">Electricity & Appliances</option>
              <option value="Transport">Vehicle & Mobility</option>
              <option value="Travel">Aviation & Commutes</option>
              <option value="Food">Dietary & Grocery</option>
              <option value="Waste">Municipal Waste</option>
            </select>
          </div>
          <span className="text-xs text-ink-muted font-medium">
            Total Telemetry Records: <strong className="text-ink">{total}</strong>
          </span>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="p-6 flex flex-col gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">
            <Receipt className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No activity events recorded yet</p>
            <p className="text-xs text-slate-400">Log an event above to start tracking telemetry</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-canvas-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Event ID & Timestamp</th>
                  <th className="py-3 px-4">Activity Descriptor</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Raw Usage</th>
                  <th className="py-3 px-4">Emission Factor</th>
                  <th className="py-3 px-4">Footprint</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-ink">
                {activities.map((act: {
                  id: string;
                  type: string;
                  category: string;
                  quantity: number;
                  unit: string;
                  occurredOn: string;
                  source: string;
                  notes?: string;
                  emissionEvents?: Array<{
                    kgCo2e: number;
                    factor: {
                      kgCo2ePerUnit: number;
                      unit: string;
                    };
                  }>;
                }) => {
                  const ev = act.emissionEvents?.[0];
                  const dateStr = new Date(act.occurredOn).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] text-ink font-semibold">
                            {act.id.slice(0, 10)}
                          </span>
                          <span className="text-[10px] text-ink-muted">{dateStr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs font-medium">
                        {act.notes || act.type}
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {act.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {act.quantity} {act.unit}
                      </td>
                      <td className="py-3 px-4 text-ink-muted tabular-nums">
                        {ev?.factor.kgCo2ePerUnit || "0.82"} kg/{ev?.factor.unit || "unit"}
                      </td>
                      <td className="py-3 px-4 font-bold text-primary tabular-nums">
                        +{ev?.kgCo2e || "0.0"} kg
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle className="h-3 w-3 text-secondary" />
                          {act.source}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="border-t border-border bg-canvas-subtle p-3 flex items-center justify-between text-xs text-ink-muted">
            <div>
              Showing <strong className="text-ink">{startRecord}</strong> to{" "}
              <strong className="text-ink">{endRecord}</strong> of{" "}
              <strong className="text-ink">{total}</strong> verified records
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                icon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>

              <span className="px-2 font-medium text-ink">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                icon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <LogActivityModal />
    </div>
  );
}
