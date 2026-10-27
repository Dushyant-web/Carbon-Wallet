"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Car, Flame, MoreHorizontal, Plane, Snowflake, TrainFront, X } from "lucide-react";
import { useAppStore } from "@/store";
import { useCreateActivity, useHouseholdActivities, useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/Button";
import { AIRPORTS } from "@/lib/airports";
import { LPG_CYLINDERS, REFRIGERANTS, toActivity, vehicleTripType, type ActivityPayload, type QuickVehicle, type RefrigerantId } from "@/lib/quickLog";
import type { Category } from "@/types";

type Kind = "lpg" | "ac_gas" | "flight" | "transit" | "drive" | "other";

const TILES: { kind: Kind; label: string; icon: React.ReactNode }[] = [
  { kind: "lpg", label: "LPG cylinder", icon: <Flame className="h-4 w-4" /> },
  { kind: "ac_gas", label: "AC gas refill", icon: <Snowflake className="h-4 w-4" /> },
  { kind: "flight", label: "Flight", icon: <Plane className="h-4 w-4" /> },
  { kind: "transit", label: "Metro, bus, train", icon: <TrainFront className="h-4 w-4" /> },
  { kind: "drive", label: "Car or bike trip", icon: <Car className="h-4 w-4" /> },
  { kind: "other", label: "Something else", icon: <MoreHorizontal className="h-4 w-4" /> },
];

// "Something else": the remaining factor types, in plain words
const OTHER: { category: Category; type: string; unit: string; label: string }[] = [
  { category: "Electricity", type: "ac_cooling", unit: "hours", label: "AC running (hours)" },
  { category: "Electricity", type: "grid_electricity", unit: "kWh", label: "Electricity (units)" },
];

type Preview = { kgCo2e: number; factorValue: number; effectiveQuantity: number; effectiveUnit: string; factorSource: string; counted: boolean; coveredBy: "bill" | "fuel" | null };
type Recent = { id: string; category: Category; type: string; quantity: number; unit: string; notes?: string | null; source: string };

const today = () => new Date().toISOString().slice(0, 10);
const label = "label-caps text-ink-muted";
const field = "mt-1 w-full rounded-md border border-border bg-canvas-card px-3 py-2 text-sm text-ink outline-none focus:border-ink";
const num = (v: string) => (v === "" ? 0 : Number(v));

export function LogActivityModal() {
  const { activeHouseholdId, isLogModalOpen, setLogModalOpen, demoRole } = useAppStore();
  const { can, role } = usePermissions();
  const create = useCreateActivity(activeHouseholdId);
  const { data: overview } = useHouseholdOverview(activeHouseholdId);
  const { data: recentData } = useHouseholdActivities(activeHouseholdId, "all", 1, 12);

  const [kind, setKind] = useState<Kind>("lpg");
  const [date, setDate] = useState(today());
  const [cylinders, setCylinders] = useState("1");
  const [cylinderKg, setCylinderKg] = useState<number>(14.2);
  const [gas, setGas] = useState<RefrigerantId>("R32");
  const [gasKg, setGasKg] = useState("0.8");
  const [from, setFrom] = useState("DEL");
  const [to, setTo] = useState("BOM");
  const [cabin, setCabin] = useState<"economy" | "business">("economy");
  const [roundTrip, setRoundTrip] = useState(true);
  const [mode, setMode] = useState<"metro" | "bus" | "train">("metro");
  const [transitKm, setTransitKm] = useState("15");
  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [driveKm, setDriveKm] = useState("20");
  const [other, setOther] = useState(OTHER[0]);
  const [otherQty, setOtherQty] = useState("4");
  const [otherNotes, setOtherNotes] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vehicles: (QuickVehicle & { id: string })[] = useMemo(
    () => (overview?.vehicles ?? []).filter((v: QuickVehicle) => vehicleTripType(v) !== null),
    [overview?.vehicles]
  );

  // Recent entries typed by hand, newest first, one per kind of entry
  const recent: Recent[] = useMemo(() => {
    const seen = new Set<string>();
    return ((recentData?.activities ?? []) as Recent[])
      .filter((a) => a.source === "MANUAL")
      .filter((a) => {
        const key = `${a.type}|${a.notes || a.quantity}`; // one chip per thing, as the chip reads
        return seen.has(key) ? false : (seen.add(key), true);
      })
      .slice(0, 4);
  }, [recentData]);

  const payload: ActivityPayload | null = useMemo(() => {
    switch (kind) {
      case "lpg":
        return toActivity({ kind, cylinders: num(cylinders), cylinderKg });
      case "ac_gas":
        return toActivity({ kind, gas, kg: num(gasKg) });
      case "flight":
        return toActivity({ kind, from, to, cabin, roundTrip });
      case "transit":
        return toActivity({ kind, mode, km: num(transitKm) });
      case "drive":
        return vehicles[vehicleIdx] ? toActivity({ kind, vehicle: vehicles[vehicleIdx], km: num(driveKm) }) : null;
      case "other":
        return num(otherQty) > 0
          ? { category: other.category, type: other.type, quantity: num(otherQty), unit: other.unit, notes: otherNotes || other.label }
          : null;
    }
  }, [kind, cylinders, cylinderKg, gas, gasKg, from, to, cabin, roundTrip, mode, transitKm, vehicles, vehicleIdx, driveKm, other, otherQty, otherNotes]);

  const occurredOn = useMemo(() => new Date(`${date}T12:00:00`), [date]);
  const body = payload ? JSON.stringify({ ...payload, occurredOn, source: "MANUAL" }) : null;

  // Live preview, computed by the server with the real factor (nothing is saved)
  useEffect(() => {
    setPreview(null);
    if (!isLogModalOpen || !body || !activeHouseholdId) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/households/${activeHouseholdId}/activities?preview=1`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-demo-role": demoRole },
          body,
          signal: ctrl.signal,
        });
        if (res.ok) setPreview(await res.json());
      } catch {
        /* superseded by a newer preview */
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [body, isLogModalOpen, activeHouseholdId, demoRole]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLogModalOpen(false);
    if (isLogModalOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isLogModalOpen, setLogModalOpen]);

  if (!isLogModalOpen) return null;
  const canCreate = can("activity:create");

  // Repeat a recent entry: it opens filled in, ready to check and save
  function repeat(a: Recent) {
    setKind("other");
    setOther(OTHER.find((o) => o.type === a.type) ?? { category: a.category, type: a.type, unit: a.unit, label: a.notes ?? a.type });
    setOtherQty(String(a.quantity));
    setOtherNotes(a.notes ?? "");
  }

  async function save() {
    if (!payload) return;
    setError(null);
    try {
      await create.mutateAsync({ ...payload, occurredOn, source: "MANUAL" });
      setLogModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this. Try again.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="log-title" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={() => setLogModalOpen(false)}>
      <div className="max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-canvas-card p-5 shadow-tier-3 sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="log-title" className="font-heading text-xl">Add to your record</h3>
            <p className="mt-0.5 text-sm text-ink-muted">Pick what happened. We work out the CO₂ for you.</p>
          </div>
          <button onClick={() => setLogModalOpen(false)} aria-label="Close" className="rounded-md p-1 text-ink-muted hover:bg-canvas-subtle hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!canCreate && (
          <p className="mt-4 rounded-md border border-border bg-canvas-subtle p-3 text-sm text-ink-muted">
            You&apos;re viewing as {role?.toLowerCase()}, so you can look but not add entries.
          </p>
        )}

        {recent.length > 0 && (
          <div className="mt-4">
            <p className={label}>Log again</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {recent.map((a) => (
                <button key={a.id} onClick={() => repeat(a)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-ink">
                  {a.notes || `${a.quantity} ${a.unit}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {TILES.map((t) => (
            <button
              key={t.kind}
              onClick={() => setKind(t.kind)}
              aria-pressed={kind === t.kind}
              className={`flex flex-col items-start gap-1.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                kind === t.kind ? "border-ink bg-ink text-canvas" : "border-border hover:border-ink"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {kind === "lpg" && (
            <>
              <label className="block">
                <span className={label}>Cylinders</span>
                <input type="number" min="1" step="1" value={cylinders} onChange={(e) => setCylinders(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className={label}>Size</span>
                <select value={cylinderKg} onChange={(e) => setCylinderKg(Number(e.target.value))} className={field}>
                  {LPG_CYLINDERS.map((c) => (
                    <option key={c.kg} value={c.kg}>{c.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {kind === "ac_gas" && (
            <>
              <label className="block">
                <span className={label}>Gas (on the AC&apos;s sticker)</span>
                <select value={gas} onChange={(e) => setGas(e.target.value as RefrigerantId)} className={field}>
                  {REFRIGERANTS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Kg added (on the bill)</span>
                <input type="number" min="0.1" max="10" step="0.1" value={gasKg} onChange={(e) => setGasKg(e.target.value)} className={field} />
              </label>
              <p className="col-span-2 text-xs text-ink-muted">
                Gas is only refilled because it leaked out, and that gas warms the planet far more than CO₂. Ask for a leak test before the next refill.
              </p>
            </>
          )}

          {kind === "flight" && (
            <>
              <label className="block">
                <span className={label}>From</span>
                <select value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
                  {AIRPORTS.map((a) => (
                    <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>To</span>
                <select value={to} onChange={(e) => setTo(e.target.value)} className={field}>
                  {AIRPORTS.map((a) => (
                    <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Class</span>
                <select value={cabin} onChange={(e) => setCabin(e.target.value as "economy" | "business")} className={field}>
                  <option value="economy">Economy</option>
                  <option value="business">Business</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} className="h-4 w-4" />
                Return trip
              </label>
              {from === to && <p className="col-span-2 text-xs text-critical">Pick two different airports.</p>}
            </>
          )}

          {kind === "transit" && (
            <>
              <label className="block">
                <span className={label}>How</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as "metro" | "bus" | "train")} className={field}>
                  <option value="metro">Metro</option>
                  <option value="bus">City bus</option>
                  <option value="train">Train (intercity)</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>Km travelled</span>
                <input type="number" min="1" step="1" value={transitKm} onChange={(e) => setTransitKm(e.target.value)} className={field} />
              </label>
            </>
          )}

          {kind === "drive" &&
            (vehicles.length === 0 ? (
              <p className="col-span-2 text-sm text-ink-muted">
                Add your car or bike under Appliances &amp; vehicles first. (Electric scooters and autos aren&apos;t covered yet.)
              </p>
            ) : (
              <>
                <label className="block">
                  <span className={label}>Vehicle</span>
                  <select value={vehicleIdx} onChange={(e) => setVehicleIdx(Number(e.target.value))} className={field}>
                    {vehicles.map((v, i) => (
                      <option key={v.id} value={i}>{v.name || v.type} · {v.fuel}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={label}>Km driven</span>
                  <input type="number" min="1" step="1" value={driveKm} onChange={(e) => setDriveKm(e.target.value)} className={field} />
                </label>
              </>
            ))}

          {kind === "other" && (
            <>
              <label className="block">
                <span className={label}>What</span>
                <select
                  value={other.type}
                  onChange={(e) => setOther(OTHER.find((o) => o.type === e.target.value) ?? other)}
                  className={field}
                >
                  {!OTHER.some((o) => o.type === other.type) && <option value={other.type}>{other.label}</option>}
                  {OTHER.map((o) => (
                    <option key={o.type} value={o.type}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>How much ({other.unit})</span>
                <input type="number" min="0.1" step="any" value={otherQty} onChange={(e) => setOtherQty(e.target.value)} className={field} />
              </label>
              <label className="col-span-2 block">
                <span className={label}>Note (optional)</span>
                <input type="text" value={otherNotes} onChange={(e) => setOtherNotes(e.target.value)} className={field} placeholder="e.g. Bedroom AC, 6 hours" />
              </label>
            </>
          )}

          <label className="block">
            <span className={label}>When</span>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className={field} />
          </label>
        </div>

        <div className="mt-5 min-h-[64px] rounded-md bg-canvas-subtle p-3" aria-live="polite">
          {preview ? (
            <>
              <p className="text-sm">
                Adds <span className="font-heading text-2xl">{preview.kgCo2e.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span> kg CO₂e
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                {preview.effectiveQuantity.toLocaleString("en-IN")} {preview.effectiveUnit} × {preview.factorValue} kg · {preview.factorSource}
              </p>
              {!preview.counted && (
                <p className="mt-1.5 text-xs text-ink-muted">
                  {preview.coveredBy === "bill"
                    ? "Your electricity bill for this period already includes this, so it's saved as a note and not counted twice."
                    : "Your fuel fill-ups for this car this month already include this, so it's saved as a note and not counted twice."}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">{payload ? "Working it out…" : "Fill in the details to see the CO₂."}</p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-critical">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setLogModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={save} disabled={!canCreate || !payload || create.isPending}>
            {create.isPending ? "Saving…" : "Add to my record"}
          </Button>
        </div>
      </div>
    </div>
  );
}
