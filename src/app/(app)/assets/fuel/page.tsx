"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, Fuel, Trash2 } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

const FUEL_EF: Record<string, number> = { Petrol: 2.31, Hybrid: 2.31, Diesel: 2.68, CNG: 2.75 };
const UNIT: Record<string, string> = { Petrol: "L", Hybrid: "L", Diesel: "L", CNG: "kg" };

type Reading = {
  fuel: string | null;
  quantity: number | null;
  amount_inr: number | null;
  rate: number | null;
  date: string | null;
  confidence: "high" | "medium" | "low";
  source: "ocr" | "ai";
  needs_ai: boolean;
  warnings: string[];
};
type FillUp = {
  id: string;
  vehicle: string;
  fuel: string;
  quantity: number;
  unit: string;
  amountInr: number | null;
  filledOn: string;
  kgCo2e: number;
  estimatedKm: number | null;
  source: string;
};

const inputCls = "h-10 w-full rounded-sm border border-border bg-canvas-card px-3 font-mono text-sm tabular-nums focus:border-ink focus:outline-none";
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export default function FuelPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data } = useHouseholdOverview(activeHouseholdId);
  const { can } = usePermissions();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [allowAi, setAllowAi] = useState(true);
  const [reading, setReading] = useState<Reading | null>(null);
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState({ quantity: "", amount: "", rate: "", date: today(), fromPhoto: false });

  const fillUps = useQuery<{ fillUps: FillUp[] }>({
    queryKey: ["household", activeHouseholdId, "fuel"],
    queryFn: async () => (await fetch(`/api/households/${activeHouseholdId}/fuel`, { headers: { "x-demo-role": demoRole } })).json(),
    enabled: !!activeHouseholdId,
  });

  if (!data) return <Skeleton className="h-96 w-full" />;
  const vehicles = (data.vehicles as { id: string; name: string; fuel: string; kmPerUnit?: number; year?: number | null }[]).filter(
    (v) => FUEL_EF[v.fuel] !== undefined,
  );
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];

  async function read(file: File | undefined) {
    if (!file) return;
    setBusy("read");
    setError(null);
    setSaved(null);
    const fd = new FormData();
    fd.set("photo", file);
    if (allowAi) fd.set("allowAi", "1");
    const res = await fetch(`/api/households/${activeHouseholdId}/fuel/read`, { method: "POST", body: fd, headers: { "x-demo-role": demoRole } });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "Couldn't read the photo");
      return;
    }
    const r: Reading = body.reading;
    setReading(r);
    setForm({
      quantity: r.quantity != null ? String(r.quantity) : "",
      amount: r.amount_inr != null ? String(r.amount_inr) : "",
      rate: r.rate != null ? String(r.rate) : "",
      date: r.date ?? today(),
      fromPhoto: true,
    });
  }

  async function save() {
    if (!vehicle) return;
    setBusy("save");
    setError(null);
    const res = await fetch(`/api/households/${activeHouseholdId}/fuel`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-role": demoRole },
      body: JSON.stringify({
        vehicleId: vehicle.id,
        quantity: Number(form.quantity),
        amountInr: form.amount ? Number(form.amount) : null,
        pricePerUnit: form.rate ? Number(form.rate) : null,
        filledOn: form.date,
        source: form.fromPhoto ? "PHOTO" : "MANUAL",
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "Couldn't save");
      return;
    }
    setSaved(
      `Saved: ${body.kgCo2e} kg CO₂e.${body.coveredTrips ? ` ${body.coveredTrips} km-based trip estimates for this car and month now stop counting, so nothing is counted twice.` : ""}`,
    );
    setReading(null);
    setForm({ quantity: "", amount: "", rate: "", date: today(), fromPhoto: false });
    qc.invalidateQueries({ queryKey: ["household", activeHouseholdId] });
  }

  const q = Number(form.quantity);
  const kg = vehicle && q > 0 ? q * FUEL_EF[vehicle.fuel] : null;
  const km = vehicle?.kmPerUnit && q > 0 ? Math.round(q * vehicle.kmPerUnit) : null;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/assets" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Appliances &amp; vehicles
        </Link>
      </div>
      <PageIntro
        section="Your home"
        title="Add fuel"
        what="Every litre of fuel burned makes a fixed amount of greenhouse gas (in CO₂e: petrol 2.37 kg, diesel 2.72 kg, CNG 2.92 kg per kg). So a fill-up is the most accurate way to count your car."
        doThis="Snap the pump's display (Amount, Volume, Rate) or the printed receipt. Check the numbers, then save."
        get="Exact CO₂ for that fill-up, about how many km it covers for your car, and a car total in Insights."
      />

      {vehicles.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Add a petrol, diesel or CNG vehicle in <Link href="/assets" className="underline">Appliances &amp; vehicles</Link> first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <section className="flex flex-col gap-5">
            <label className="flex flex-col gap-1">
              <span className="label-caps">Vehicle</span>
              <select className={inputCls} value={vehicle?.id} onChange={(e) => setVehicleId(e.target.value)}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.fuel}
                    {v.year ? ` · ${v.year}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="flex min-h-[200px] flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-canvas-subtle/60 p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                read(e.dataTransfer.files?.[0]);
              }}
            >
              {busy === "read" ? (
                <>
                  <span className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-secondary" />
                  <p className="text-sm">Reading the photo…</p>
                </>
              ) : (
                <>
                  <Fuel className="h-8 w-8 text-ink-light" />
                  <p className="font-heading text-lg">Photo of the pump display or receipt</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => camRef.current?.click()} disabled={!can("activity:create")}>
                      Take photo
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={!can("activity:create")}>
                      Choose file
                    </Button>
                  </div>
                </>
              )}
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <label className="flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" className="mt-0.5 accent-[#1D1C18]" checked={allowAi} onChange={(e) => setAllowAi(e.target.checked)} />
              <span>
                Read pump screens more carefully
                <span className="block text-ink-muted">Recommended for photos of the pump&apos;s screen. The photo is read by our partner service and isn&apos;t stored.</span>
              </span>
            </label>
            <button className="self-start text-[13px] text-ink-muted underline underline-offset-2" onClick={() => { setReading(null); setForm({ ...form, fromPhoto: false }); }}>
              No photo? Type it in →
            </button>
          </section>

          <section className="flex flex-col gap-4 border-t border-ink pt-4 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <div className="flex items-center justify-between">
              <span className="label-caps">Check &amp; save</span>
              {reading && (
                <span
                  className={`label-caps border px-1.5 py-0.5 ${
                    reading.confidence === "high"
                      ? "border-success-border bg-success-subtle text-success-text"
                      : reading.confidence === "medium"
                        ? "border-warning-border bg-warning-subtle text-warning-text"
                        : "border-critical-border bg-critical-subtle text-critical-text"
                  }`}
                >
                  {reading.confidence === "high" ? "Numbers agree" : reading.confidence === "medium" ? "Please check" : "Unsure"}
                </span>
              )}
            </div>
            {reading?.warnings.map((w) => (
              <p key={w} className="text-[13px] text-warning-text">{w}</p>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="label-caps">Fuel ({vehicle ? UNIT[vehicle.fuel] : "L"})</span>
                <input className={inputCls} inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="25.40" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label-caps">Paid (₹)</span>
                <input className={inputCls} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="2400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label-caps">Rate (₹ per {vehicle ? UNIT[vehicle.fuel] : "L"})</span>
                <input className={inputCls} inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="94.72" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label-caps">Date</span>
                <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
            </div>
            {kg !== null && vehicle && (
              <div className="bg-primary px-5 py-4 text-canvas-card">
                <span className="label-caps text-canvas-card/60">This fill-up</span>
                <p className="mt-1 font-heading text-3xl tabular-nums">
                  {kg.toFixed(1)} <span className="text-base text-canvas-card/70">kg CO₂e</span>
                </p>
                {km ? <p className="mt-1 text-[12px] text-canvas-card/70">Enough for about {km} km in your {vehicle.name}</p> : null}
              </div>
            )}
            {error && <p className="text-[13px] text-critical-text">{error}</p>}
            {saved && (
              <p className="flex items-start gap-2 border border-success-border bg-success-subtle px-3 py-2 text-[13px] text-success-text">
                <Check className="mt-0.5 h-4 w-4 shrink-0" /> {saved}
              </p>
            )}
            <Button disabled={!(q > 0) || busy === "save" || !can("activity:create")} onClick={save} icon={<Check className="h-4 w-4" />}>
              {busy === "save" ? "Saving…" : "Save fill-up"}
            </Button>
          </section>
        </div>
      )}

      <section>
        <span className="label-caps">Recent fill-ups</span>
        {(fillUps.data?.fillUps ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">None yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps pb-2 font-medium">Date</th>
                  <th className="label-caps pb-2 font-medium">Vehicle</th>
                  <th className="label-caps pb-2 text-right font-medium">Fuel</th>
                  <th className="label-caps pb-2 text-right font-medium">Paid</th>
                  <th className="label-caps pb-2 text-right font-medium">CO₂e</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {fillUps.data!.fillUps.map((f) => (
                  <tr key={f.id} className="border-b border-border/70">
                    <td className="py-2.5 font-mono text-xs">{f.filledOn}</td>
                    <td className="py-2.5">
                      {f.vehicle}
                      <span className="block text-[11px] text-ink-muted">{f.source === "PHOTO" ? "from a photo" : "typed in"}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{f.quantity} {f.unit}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{f.amountInr != null ? `₹${f.amountInr.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{f.kgCo2e} kg</td>
                    <td className="py-2.5 text-right">
                      {can("activity:delete") && (
                        <button
                          aria-label="Delete fill-up"
                          className="p-1 text-ink-light hover:text-critical-text"
                          onClick={async () => {
                            await fetch(`/api/households/${activeHouseholdId}/fuel/${f.id}`, { method: "DELETE", headers: { "x-demo-role": demoRole } });
                            qc.invalidateQueries({ queryKey: ["household", activeHouseholdId] });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
