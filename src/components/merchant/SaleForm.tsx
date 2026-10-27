"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AC_CAPACITIES,
  APPLIANCE_TYPES,
  FUELS,
  MERCHANT_VEHICLE_TYPES,
  REFRIGERANTS,
  suggestedMileage,
} from "@/lib/assets";
import { sellsAppliances, sellsVehicles } from "@/lib/merchant";

export type SaleKind = "AC" | "APPLIANCE" | "VEHICLE";
export type SalePayload = { kind: "APPLIANCE" | "VEHICLE"; item: Record<string, unknown> };

const inputCls = "h-10 w-full rounded-sm border border-border bg-canvas-card px-3 text-sm text-ink focus:border-ink focus:outline-none";
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the shop's own time zone, not UTC
const num = (v: string) => (v.trim() === "" ? null : Number(v));
const OTHER_APPLIANCES = APPLIANCE_TYPES.filter(([v]) => v !== "AC");

function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="label-caps">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </label>
  );
}

/** What the shop types in from the BEE star label, the invoice and the box. Usage is left to the household. */
export function SaleForm({ sells, busy, onSubmit }: { sells: string; busy: boolean; onSubmit: (p: SalePayload) => void }) {
  const kinds: [SaleKind, string][] = [
    ...(sellsAppliances(sells) ? ([["AC", "Air conditioner"], ["APPLIANCE", "Other appliance"]] as [SaleKind, string][]) : []),
    ...(sellsVehicles(sells) ? ([["VEHICLE", "Vehicle"]] as [SaleKind, string][]) : []),
  ];
  const [kind, setKind] = useState<SaleKind>(kinds[0][0]);

  return (
    <div>
      {kinds.length > 1 && (
        <div role="tablist" aria-label="What was bought" className="flex flex-wrap gap-2">
          {kinds.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`h-9 rounded-md border px-3 text-sm ${kind === k ? "border-ink bg-ink text-canvas-card" : "border-border bg-canvas-card hover:border-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        {kind === "VEHICLE" ? (
          <VehicleSale busy={busy} onSubmit={onSubmit} />
        ) : (
          <ApplianceSale key={kind} ac={kind === "AC"} busy={busy} onSubmit={onSubmit} />
        )}
      </div>
    </div>
  );
}

function ApplianceSale({ ac, busy, onSubmit }: { ac: boolean; busy: boolean; onSubmit: (p: SalePayload) => void }) {
  const [f, setF] = useState({
    type: ac ? "AC" : "Refrigerator",
    brand: "",
    model: "",
    capacityTon: "1.5",
    stars: "5",
    inverter: ac,
    labelYear: String(new Date().getFullYear()),
    ratedPowerW: "",
    annualKwh: "",
    refrigerant: ac ? "R32" : "",
    serialNo: "",
    invoiceRef: "",
    purchasedOn: today(),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="grid grid-cols-1 gap-4 border border-ink bg-canvas-card p-5 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          kind: "APPLIANCE",
          item: {
            type: f.type,
            brand: f.brand,
            model: f.model,
            stars: Number(f.stars),
            inverter: f.inverter,
            labelYear: num(f.labelYear),
            ratedPowerW: Number(f.ratedPowerW),
            capacityTon: ac ? Number(f.capacityTon) : null,
            annualKwh: num(f.annualKwh),
            refrigerant: f.refrigerant || null,
            serialNo: f.serialNo,
            invoiceRef: f.invoiceRef || undefined,
            purchasedOn: f.purchasedOn,
          },
        });
      }}
    >
      {!ac && (
        <Field label="Appliance">
          <select className={inputCls} value={f.type} onChange={set("type")}>
            {OTHER_APPLIANCES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Brand">
        <input className={inputCls} value={f.brand} onChange={set("brand")} required maxLength={40} />
      </Field>
      <Field label="Model number">
        <input className={inputCls} value={f.model} onChange={set("model")} required maxLength={60} />
      </Field>
      {ac && (
        <Field label="Capacity">
          <select className={inputCls} value={f.capacityTon} onChange={set("capacityTon")}>
            {AC_CAPACITIES.map((t) => (
              <option key={t} value={t}>{t} ton</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="BEE stars">
        <select className={inputCls} value={f.stars} onChange={set("stars")}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n}-star</option>
          ))}
          <option value={0}>No star label</option>
        </select>
      </Field>
      <Field label="Label year" hint="Printed on the star label. Star bands change every few years.">
        <input className={inputCls} inputMode="numeric" value={f.labelYear} onChange={set("labelYear")} maxLength={4} />
      </Field>
      <Field label="Rated power (W)" hint={ac ? "Rated input power on the label, e.g. 1450" : "Rated input power on the label"}>
        <input className={inputCls} inputMode="numeric" value={f.ratedPowerW} onChange={set("ratedPowerW")} required />
      </Field>
      <Field label="Energy a year (kWh, optional)" hint="“Annual energy consumption” on the label">
        <input className={inputCls} inputMode="numeric" value={f.annualKwh} onChange={set("annualKwh")} />
      </Field>
      {ac && (
        <Field label="Refrigerant">
          <select className={inputCls} value={f.refrigerant} onChange={set("refrigerant")}>
            {REFRIGERANTS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
            <option value="">Not sure</option>
          </select>
        </Field>
      )}
      <Field label="Serial number">
        <input className={`${inputCls} font-mono`} value={f.serialNo} onChange={set("serialNo")} required minLength={3} maxLength={60} />
      </Field>
      <Field label="Invoice no. (optional)">
        <input className={`${inputCls} font-mono`} value={f.invoiceRef} onChange={set("invoiceRef")} maxLength={40} />
      </Field>
      <Field label="Purchase date">
        <input className={inputCls} type="date" value={f.purchasedOn} max={today()} onChange={set("purchasedOn")} required />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" checked={f.inverter} onChange={(e) => setF({ ...f, inverter: e.target.checked })} className="h-4 w-4 accent-ink" />
        Inverter
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={busy}>
          {busy ? "Registering…" : "Register to this home"}
        </Button>
      </div>
    </form>
  );
}

function VehicleSale({ busy, onSubmit }: { busy: boolean; onSubmit: (p: SalePayload) => void }) {
  const [f, setF] = useState({
    type: "Car",
    fuel: "Petrol",
    make: "",
    model: "",
    variant: "",
    year: String(new Date().getFullYear()),
    kmPerUnit: "",
    vin: "",
    registrationNo: "",
    invoiceRef: "",
    purchasedOn: today(),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const suggested = suggestedMileage(f.type, f.fuel, Number(f.year) || null);
  const unit = f.fuel === "Electric" ? "kWh" : f.fuel === "CNG" ? "kg" : "L";

  return (
    <form
      className="grid grid-cols-1 gap-4 border border-ink bg-canvas-card p-5 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          kind: "VEHICLE",
          item: {
            type: f.type,
            fuel: f.fuel,
            make: f.make,
            model: f.model,
            variant: f.variant || undefined,
            year: Number(f.year),
            kmPerUnit: num(f.kmPerUnit),
            vin: f.vin,
            registrationNo: f.registrationNo || null,
            invoiceRef: f.invoiceRef || undefined,
            purchasedOn: f.purchasedOn,
          },
        });
      }}
    >
      <Field label="Type">
        <select className={inputCls} value={f.type} onChange={set("type")}>
          {MERCHANT_VEHICLE_TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Fuel">
        <select className={inputCls} value={f.fuel} onChange={set("fuel")}>
          {FUELS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Field>
      <Field label="Make">
        <input className={inputCls} value={f.make} onChange={set("make")} required maxLength={40} />
      </Field>
      <Field label="Model">
        <input className={inputCls} value={f.model} onChange={set("model")} required maxLength={60} />
      </Field>
      <Field label="Variant (optional)">
        <input className={inputCls} value={f.variant} onChange={set("variant")} maxLength={60} />
      </Field>
      <Field label="Model year">
        <input className={inputCls} inputMode="numeric" value={f.year} onChange={set("year")} required maxLength={4} />
      </Field>
      <Field label={`Certified mileage (km/${unit})`} hint={`From the brochure (ARAI). Blank uses ${suggested}, typical for this type.`}>
        <input className={inputCls} inputMode="decimal" value={f.kmPerUnit} onChange={set("kmPerUnit")} placeholder={String(suggested)} />
      </Field>
      <Field label="Chassis number (VIN)">
        <input className={`${inputCls} font-mono uppercase`} value={f.vin} onChange={set("vin")} required minLength={11} maxLength={17} />
      </Field>
      <Field label="Registration no. (optional)" hint="If the RTO has issued it already">
        <input className={`${inputCls} font-mono uppercase`} value={f.registrationNo} onChange={set("registrationNo")} maxLength={15} />
      </Field>
      <Field label="Invoice no. (optional)">
        <input className={`${inputCls} font-mono`} value={f.invoiceRef} onChange={set("invoiceRef")} maxLength={40} />
      </Field>
      <Field label="Purchase date">
        <input className={inputCls} type="date" value={f.purchasedOn} max={today()} onChange={set("purchasedOn")} required />
      </Field>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={busy}>
          {busy ? "Registering…" : "Register to this home"}
        </Button>
      </div>
    </form>
  );
}
