"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/states/EmptyState";
import { Layers, Zap, Car, Sun, ShieldCheck } from "lucide-react";

export default function AssetsPage() {
  const { activeHouseholdId } = useAppStore();
  const { data, isLoading } = useHouseholdOverview(activeHouseholdId);
  const [activeTab, setActiveTab] = useState<"appliances" | "vehicles">("appliances");

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { household, appliances, vehicles, solar } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6 text-secondary" />
          <h1 className="font-heading text-2xl font-bold text-ink">
            Household Assets & Equipment Inventory
          </h1>
        </div>
        <p className="text-xs text-ink-muted">
          Connected thermodynamic assets, appliance ratings, and commuter garage fleet for {household.name}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("appliances")}
          className={`flex items-center gap-2 pb-3 transition-colors ${
            activeTab === "appliances"
              ? "border-b-2 border-primary text-primary font-bold"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>Appliances & Thermal Load ({appliances.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("vehicles")}
          className={`flex items-center gap-2 pb-3 transition-colors ${
            activeTab === "vehicles"
              ? "border-b-2 border-primary text-primary font-bold"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <Car className="h-4 w-4" />
          <span>Vehicle & Mobility Fleet ({vehicles.length})</span>
        </button>
      </div>

      {/* Tab 1: Appliances */}
      {activeTab === "appliances" && (
        appliances.length === 0 && !solar.hasSolar ? (
          <EmptyState
            icon={<Zap className="h-6 w-6 text-slate-400" />}
            title="No Registered Appliances"
            description="No connected electrical appliances or thermal equipment have been registered for this household yet."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {appliances.map((app: {
              id: string;
              name: string;
              type: string;
              rating: string;
              powerKw: number;
            }) => (
              <Card key={app.id} className="flex flex-col justify-between p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-primary border border-emerald-200">
                    {app.type}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-secondary">
                    <ShieldCheck className="h-3.5 w-3.5" /> Certified
                  </span>
                </div>
                <h3 className="font-heading text-base font-bold text-ink mb-1">
                  {app.name}
                </h3>
                <p className="text-xs text-ink-muted mb-4">
                  Energy Star Rating: <strong>{app.rating}</strong>
                </p>
                <div className="border-t border-border pt-3 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Rated Power Draw:</span>
                  <span className="font-bold text-primary tabular-nums">
                    {app.powerKw} kW
                  </span>
                </div>
              </Card>
            ))}

            {solar.hasSolar && (
              <Card className="flex flex-col justify-between p-5 border-amber-200 bg-amber-50/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                    Solar PV Inverter
                  </span>
                  <Sun className="h-4 w-4 text-amber-600" />
                </div>
                <h3 className="font-heading text-base font-bold text-ink mb-1">
                  Rooftop Solar Generation System
                </h3>
                <p className="text-xs text-ink-muted mb-4">
                  Net-metered clean solar feed offsetting daytime grid draw.
                </p>
                <div className="border-t border-amber-200 pt-3 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Monthly Output:</span>
                  <span className="font-bold text-amber-800 tabular-nums">
                    {solar.solarKwh} kWh / mo Clean Energy
                  </span>
                </div>
              </Card>
            )}
          </div>
        )
      )}

      {/* Tab 2: Vehicles */}
      {activeTab === "vehicles" && (
        vehicles.length === 0 ? (
          <EmptyState
            icon={<Car className="h-6 w-6 text-slate-400" />}
            title="No Registered Vehicles"
            description="No private vehicles or garage assets registered. Footprint calculations default to public transit averages."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((veh: {
              id: string;
              name: string;
              type: string;
              fuel: string;
              monthlyKm: number;
            }) => (
              <Card key={veh.id} className="flex flex-col justify-between p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-primary border border-border">
                    {veh.type}
                  </span>
                  <Car className="h-4 w-4 text-secondary" />
                </div>
                <h3 className="font-heading text-base font-bold text-ink mb-1">
                  {veh.name}
                </h3>
                <p className="text-xs text-ink-muted mb-4">
                  Powertrain: <strong>{veh.fuel}</strong>
                </p>
                <div className="border-t border-border pt-3 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Monthly Distance:</span>
                  <span className="font-bold text-primary tabular-nums">
                    {veh.monthlyKm} km / mo
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
