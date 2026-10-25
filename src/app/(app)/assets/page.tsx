"use client";

import React, { useState } from "react";
import { HowCalculated } from "@/components/ui/HowCalculated";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionHeading } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { APPLIANCE_TYPES, FUELS, RATINGS, VEHICLE_TYPES, labelOf } from "@/lib/assets";

const GRID_EF = 0.675; // kg CO2 per kWh, CEA 2025-26
const FUEL_EF: Record<string, number> = { Petrol: 2.31, Diesel: 2.68, CNG: 2.75, Hybrid: 2.31 }; // kg per litre (CNG per kg)
const FUEL_UNIT: Record<string, string> = { Petrol: "L", Diesel: "L", CNG: "kg", Hybrid: "L", Electric: "kWh" };

// Typical real-world mileage in India, used only to pre-fill the form (people can type their own)
const TYPICAL_MILEAGE: Record<string, Record<string, number>> = {
  Car: { Petrol: 14, Diesel: 17, CNG: 24, Hybrid: 20, Electric: 7 },
  SUV: { Petrol: 11, Diesel: 13, CNG: 18, Hybrid: 16, Electric: 5.5 },
  TwoWheeler: { Petrol: 45, Diesel: 45, CNG: 45, Hybrid: 45, Electric: 30 },
  ThreeWheeler: { Petrol: 25, Diesel: 28, CNG: 30, Hybrid: 28, Electric: 12 },
  PublicTransit: { Petrol: 14, Diesel: 14, CNG: 14, Hybrid: 14, Electric: 14 },
};
/** Mileage drops as engines age: ~1% a year after the fifth year (rule of thumb; edit if you know yours). */
function suggestedMileage(type: string, fuel: string, year: number | null) {
  const base = TYPICAL_MILEAGE[type]?.[fuel] ?? 14;
  const age = year ? Math.max(0, new Date().getFullYear() - year) : 0;
  return Math.round(base * Math.pow(0.99, Math.max(0, age - 5)) * 10) / 10;
}

type Appliance = { id: string; name: string; type: string; rating: string; powerKw: number; avgHoursPerDay?: number };
type Vehicle = { id: string; name: string; type: string; fuel: string; monthlyKm: number; kmPerUnit?: number; year?: number | null };

const inputCls = "h-10 w-full rounded-sm border border-border bg-canvas-card px-3 text-sm text-ink focus:border-ink focus:outline-none";

function applianceMonthly(a: Appliance) {
  const kwh = a.powerKw * (a.avgHoursPerDay ?? 0) * 30;
  return { kwh, kg: kwh * GRID_EF };
}
function vehicleMonthly(v: Vehicle) {
  const per = v.kmPerUnit && v.kmPerUnit > 0 ? v.kmPerUnit : null;
  if (!per || v.type === "PublicTransit") return null;
  const units = v.monthlyKm / per;
  const kg = v.fuel === "Electric" ? units * GRID_EF : units * (FUEL_EF[v.fuel] ?? 2.31);
  return { units, unit: FUEL_UNIT[v.fuel] ?? "L", kg };
}

export default function AssetsPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data, isLoading } = useHouseholdOverview(activeHouseholdId);
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ kind: "appliance" | "vehicle"; item: Appliance | Vehicle | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const appliances: Appliance[] = data.appliances;
  const vehicles: Vehicle[] = data.vehicles;
  const canEdit = can("asset:create");

  async function save(kind: "appliance" | "vehicle", id: string | null, body: Record<string, unknown>) {
    setError(null);
    const base = `/api/households/${activeHouseholdId}/${kind}s`;
    const res = await fetch(id ? `${base}/${id}` : base, {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json", "x-demo-role": demoRole },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(out.error ?? out.details?.issues?.[0]?.message ?? "Couldn't save");
      return;
    }
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["household", activeHouseholdId] });
  }

  async function remove(kind: "appliance" | "vehicle", id: string) {
    const res = await fetch(`/api/households/${activeHouseholdId}/${kind}s/${id}`, { method: "DELETE", headers: { "x-demo-role": demoRole } });
    if (res.ok) qc.invalidateQueries({ queryKey: ["household", activeHouseholdId] });
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't delete");
  }

  const appTotal = appliances.filter((a) => a.type !== "SolarPV").reduce((s, a) => s + applianceMonthly(a).kg, 0);

  return (
    <div className="flex flex-col gap-12">
      <PageIntro
        section="Your home"
        title="Appliances & vehicles"
        what="The things in your home that use electricity or fuel. We use them to estimate what each one adds and to work out your suggestions."
        doThis="Add your ACs, fridge, geyser and vehicles. For a vehicle, you can also add fuel fill-ups from a photo of the pump."
        get="A monthly CO₂ estimate for each item, and savings tips sized to what you actually own."
      />

      {error && <p className="text-[13px] text-critical-text">{error}</p>}

      {/* Appliances */}
      <section>
        <SectionHeading
          index="01"
          title={`Appliances (${appliances.length})`}
          meta={appliances.length ? `≈ ${Math.round(appTotal)} kg CO₂ a month if run as set` : undefined}
        />
        {canEdit && (
          <div className="mt-4">
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing({ kind: "appliance", item: null })}>
              Add appliance
            </Button>
          </div>
        )}
        {editing?.kind === "appliance" && (
          <ApplianceForm item={editing.item as Appliance | null} onCancel={() => setEditing(null)} onSave={(b) => save("appliance", editing.item?.id ?? null, b)} />
        )}
        {appliances.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No appliances yet. Start with your ACs: they&apos;re usually the biggest.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps pb-2 font-medium">Item</th>
                  <th className="label-caps pb-2 font-medium">Label</th>
                  <th className="label-caps pb-2 text-right font-medium">Power</th>
                  <th className="label-caps pb-2 text-right font-medium">Hours a day</th>
                  <th className="label-caps pb-2 text-right font-medium">CO₂ a month (est.)</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {appliances.map((a) => {
                  const m = applianceMonthly(a);
                  return (
                    <tr key={a.id} className="border-b border-border/70">
                      <td className="py-3 pr-3">
                        {a.name}
                        <span className="block text-[11px] text-ink-muted">{labelOf(APPLIANCE_TYPES, a.type)}</span>
                      </td>
                      <td className="py-3 text-ink-muted">{labelOf(RATINGS, a.rating)}</td>
                      <td className="py-3 text-right font-mono tabular-nums">{a.powerKw} kW</td>
                      <td className="py-3 text-right font-mono tabular-nums">{a.avgHoursPerDay ?? "—"}</td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        {a.type === "SolarPV" ? "makes power" : `${Math.round(m.kg)} kg`}
                        {a.type !== "SolarPV" && <span className="block text-[10px] text-ink-muted">{Math.round(m.kwh)} units</span>}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        {canEdit && (
                          <button aria-label={`Edit ${a.name}`} onClick={() => setEditing({ kind: "appliance", item: a })} className="p-1.5 text-ink-light hover:text-ink">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {can("asset:delete") && (
                          <button aria-label={`Delete ${a.name}`} onClick={() => remove("appliance", a.id)} className="p-1.5 text-ink-light hover:text-critical-text">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <HowCalculated className="mt-3">
          From the power on each label and the hours you set, over 30 days. Your real total comes from your{" "}
          <Link href="/bills" className="underline underline-offset-2">electricity bills</Link>, and the{" "}
          <Link href="/calibration" className="underline underline-offset-2">AC page</Link> measures your AC&apos;s true power from them.
        </HowCalculated>
      </section>

      {/* Vehicles */}
      <section>
        <SectionHeading index="02" title={`Vehicles (${vehicles.length})`} />
        {canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing({ kind: "vehicle", item: null })}>
              Add vehicle
            </Button>
            {vehicles.length > 0 && (
              <Link
                href="/assets/fuel"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-canvas-card px-3 text-xs font-medium hover:border-ink"
              >
                <Camera className="h-3.5 w-3.5" /> Add fuel from a pump photo
              </Link>
            )}
          </div>
        )}
        {editing?.kind === "vehicle" && (
          <VehicleForm item={editing.item as Vehicle | null} onCancel={() => setEditing(null)} onSave={(b) => save("vehicle", editing.item?.id ?? null, b)} />
        )}
        {vehicles.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No vehicles yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps pb-2 font-medium">Vehicle</th>
                  <th className="label-caps pb-2 font-medium">Fuel</th>
                  <th className="label-caps pb-2 text-right font-medium">Mileage</th>
                  <th className="label-caps pb-2 text-right font-medium">km a month</th>
                  <th className="label-caps pb-2 text-right font-medium">CO₂ a month (est.)</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const m = vehicleMonthly(v);
                  return (
                    <tr key={v.id} className="border-b border-border/70">
                      <td className="py-3 pr-3">
                        {v.name}
                        <span className="block text-[11px] text-ink-muted">
                          {labelOf(VEHICLE_TYPES, v.type)}
                          {v.year ? ` · ${v.year} (${new Date().getFullYear() - v.year} yrs old)` : ""}
                        </span>
                      </td>
                      <td className="py-3 text-ink-muted">{v.fuel}</td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        {v.kmPerUnit ? `${v.kmPerUnit} km/${FUEL_UNIT[v.fuel] ?? "L"}` : "—"}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums">{v.monthlyKm}</td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        {m ? `${Math.round(m.kg)} kg` : "—"}
                        {m && (
                          <span className="block text-[10px] text-ink-muted">
                            {m.units.toFixed(1)} {m.unit} a month
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        {canEdit && (
                          <button aria-label={`Edit ${v.name}`} onClick={() => setEditing({ kind: "vehicle", item: v })} className="p-1.5 text-ink-light hover:text-ink">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {can("asset:delete") && (
                          <button aria-label={`Delete ${v.name}`} onClick={() => remove("vehicle", v.id)} className="p-1.5 text-ink-light hover:text-critical-text">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <HowCalculated className="mt-3">
          Each litre of petrol burned makes 2.31 kg of CO₂, diesel 2.68 kg and a kilo of CNG 2.75 kg. Fuel fill-ups you add are counted
          exactly; the km estimate here is only a guide.
        </HowCalculated>
      </section>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </label>
  );
}

function ApplianceForm({ item, onSave, onCancel }: { item: Appliance | null; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: item?.name ?? "",
    type: item?.type ?? "AC",
    rating: item?.rating ?? "3_STAR",
    powerKw: String(item?.powerKw ?? "1.5"),
    avgHoursPerDay: String(item?.avgHoursPerDay ?? "6"),
  });
  return (
    <form
      className="mt-4 grid grid-cols-1 gap-4 border border-ink bg-canvas-card p-5 md:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: f.name, type: f.type, rating: f.rating, powerKw: Number(f.powerKw), avgHoursPerDay: Number(f.avgHoursPerDay) });
      }}
    >
      <Field label="Name">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Bedroom AC" required />
      </Field>
      <Field label="Type">
        <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {APPLIANCE_TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Star label">
        <select className={inputCls} value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })}>
          {RATINGS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Power (kW)" hint="On the sticker; 1.5-ton AC ≈ 1.5">
        <input className={inputCls} inputMode="decimal" value={f.powerKw} onChange={(e) => setF({ ...f, powerKw: e.target.value })} />
      </Field>
      <Field label="Hours a day">
        <input className={inputCls} inputMode="decimal" value={f.avgHoursPerDay} onChange={(e) => setF({ ...f, avgHoursPerDay: e.target.value })} />
      </Field>
      <div className="flex gap-2 md:col-span-5">
        <Button type="submit" size="sm">{item ? "Save changes" : "Add appliance"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function VehicleForm({ item, onSave, onCancel }: { item: Vehicle | null; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: item?.name ?? "",
    type: item?.type ?? "Car",
    fuel: item?.fuel ?? "Petrol",
    year: item?.year ? String(item.year) : "",
    kmPerUnit: item?.kmPerUnit ? String(item.kmPerUnit) : "",
    monthlyKm: String(item?.monthlyKm ?? "600"),
  });
  const year = f.year ? Number(f.year) : null;
  const suggested = suggestedMileage(f.type, f.fuel, year);
  return (
    <form
      className="mt-4 grid grid-cols-1 gap-4 border border-ink bg-canvas-card p-5 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: f.name,
          type: f.type,
          fuel: f.fuel,
          year,
          kmPerUnit: f.kmPerUnit ? Number(f.kmPerUnit) : suggested,
          monthlyKm: Number(f.monthlyKm),
        });
      }}
    >
      <Field label="Name">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Swift Dzire" required />
      </Field>
      <Field label="Type">
        <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {VEHICLE_TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Fuel">
        <select className={inputCls} value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })}>
          {FUELS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
      <Field label="Model year">
        <input className={inputCls} inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} placeholder="2019" />
      </Field>
      <Field label={`Mileage (km/${FUEL_UNIT[f.fuel] ?? "L"})`} hint={`Leave blank for ${suggested}, typical for this type and age`}>
        <input className={inputCls} inputMode="decimal" value={f.kmPerUnit} onChange={(e) => setF({ ...f, kmPerUnit: e.target.value })} placeholder={String(suggested)} />
      </Field>
      <Field label="km a month">
        <input className={inputCls} inputMode="numeric" value={f.monthlyKm} onChange={(e) => setF({ ...f, monthlyKm: e.target.value })} />
      </Field>
      <div className="flex gap-2 md:col-span-6">
        <Button type="submit" size="sm">{item ? "Save changes" : "Add vehicle"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
