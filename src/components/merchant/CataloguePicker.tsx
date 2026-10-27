"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Leaf, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { inr } from "@/lib/plainWords";
import { ProductFacts, StarBadge, type CatalogueItemView } from "./CatalogueManager";

export type PickPayload = { kind: "APPLIANCE" | "VEHICLE"; catalogueItemId: string; item: Record<string, unknown> };

const inputCls = "h-11 w-full rounded-sm border border-border bg-canvas-card px-3 text-sm text-ink focus:border-ink focus:outline-none";
const today = () => new Date().toLocaleDateString("en-CA");

/**
 * The counter's fast path: pick the product from the shop's catalogue, then type only what's unique to this unit
 * (serial or chassis number, invoice). The customer sees running cost and carbon before the bill is made.
 */
export function CataloguePicker({ busy, onSubmit, onTypeInstead }: { busy: boolean; onSubmit: (p: PickPayload) => void; onTypeInstead: () => void }) {
  const { t } = useUiPrefs();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<CatalogueItemView | null>(null);
  const [unit, setUnit] = useState({ serialNo: "", vin: "", registrationNo: "", invoiceRef: "", purchasedOn: today() });
  const { data, isLoading } = useQuery<{ items: CatalogueItemView[] }>({
    queryKey: ["merchant", "catalogue", "active"],
    queryFn: async () => (await fetch("/api/merchant/catalogue?active=1")).json(),
  });
  const items = useMemo(() => (data?.items ?? []).filter((i) => !q || `${i.title} ${i.sku} ${i.brand} ${i.model}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  if (isLoading) return <div className="h-40 animate-pulse bg-canvas-subtle" />;
  if (!data?.items.length) {
    return (
      <div className="border border-border bg-canvas-card p-5 text-[14px]">
        {t("Your catalogue is empty. Upload it once from the Catalogue page, or type the item in.", "आपका कैटलॉग ख़ाली है। कैटलॉग पेज से अपलोड करें, या सामान टाइप करें।")}{" "}
        <button onClick={onTypeInstead} className="font-semibold underline">{t("Type it in", "टाइप करें")}</button>
      </div>
    );
  }

  if (picked) {
    const vehicle = picked.kind === "VEHICLE";
    return (
      <form
        className="grid grid-cols-1 gap-5 border border-ink bg-canvas-card p-5 lg:grid-cols-[280px_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            kind: picked.kind as "APPLIANCE" | "VEHICLE",
            catalogueItemId: picked.id,
            item: vehicle
              ? { vin: unit.vin, registrationNo: unit.registrationNo || null, invoiceRef: unit.invoiceRef || undefined, purchasedOn: unit.purchasedOn }
              : { serialNo: unit.serialNo, invoiceRef: unit.invoiceRef || undefined, purchasedOn: unit.purchasedOn },
          });
        }}
      >
        <div>
          <div className="flex h-44 items-center justify-center border border-border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {picked.imageUrl ? <img src={picked.imageUrl} alt={picked.title} className="h-full w-full object-contain p-2" /> : <Zap className="h-10 w-10 text-ink-light" />}
          </div>
          <p className="mt-2 text-[15px] font-semibold">{picked.title}</p>
          <p className="font-heading text-xl font-semibold">{inr(picked.priceInr)}</p>
          <div className="mt-1"><StarBadge stars={picked.stars} inverter={picked.inverter} /></div>
          <div className="mt-3"><ProductFacts item={picked} /></div>
          {picked.facts.benefitNote && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-success-text">
              <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {picked.facts.benefitNote}
            </p>
          )}
          <button type="button" onClick={() => setPicked(null)} className="mt-3 text-[13px] underline">{t("Pick another product", "दूसरा उत्पाद चुनें")}</button>
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-ink-muted">{t("The label figures come from your catalogue. Enter what's on this unit:", "लेबल के आँकड़े कैटलॉग से आते हैं। इस सामान का यह भरें:")}</p>
          {vehicle ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="label-caps">{t("Chassis number (VIN)", "चेसिस नंबर (VIN)")}</span>
                <input className={`${inputCls} font-mono uppercase`} value={unit.vin} onChange={(e) => setUnit({ ...unit, vin: e.target.value })} required minLength={11} maxLength={17} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label-caps">{t("Registration no. (if issued)", "रजिस्ट्रेशन नंबर (अगर है)")}</span>
                <input className={`${inputCls} font-mono uppercase`} value={unit.registrationNo} onChange={(e) => setUnit({ ...unit, registrationNo: e.target.value })} maxLength={15} />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="label-caps">{t("Serial number", "सीरियल नंबर")}</span>
              <input className={`${inputCls} font-mono`} value={unit.serialNo} onChange={(e) => setUnit({ ...unit, serialNo: e.target.value })} required minLength={3} maxLength={60} autoFocus />
            </label>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="label-caps">{t("Invoice no. (optional)", "बिल नंबर (वैकल्पिक)")}</span>
              <input className={`${inputCls} font-mono`} value={unit.invoiceRef} onChange={(e) => setUnit({ ...unit, invoiceRef: e.target.value })} maxLength={40} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-caps">{t("Purchase date", "ख़रीद की तारीख़")}</span>
              <input className={inputCls} type="date" value={unit.purchasedOn} max={today()} onChange={(e) => setUnit({ ...unit, purchasedOn: e.target.value })} required />
            </label>
          </div>
          <div className="mt-auto">
            <Button type="submit" size="lg" disabled={busy}>{busy ? t("Registering…", "दर्ज हो रहा है…") : t("Register to this home", "इस घर में दर्ज करें")}</Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-md border border-border bg-canvas-card px-3">
          <Search className="h-4 w-4 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search your catalogue: brand, model, SKU", "कैटलॉग में खोजें: ब्रांड, मॉडल, SKU")} className="w-full bg-transparent text-[14px] focus:outline-none" autoFocus />
        </label>
        <button onClick={onTypeInstead} className="text-[13px] underline">{t("Not in the catalogue? Type it in", "कैटलॉग में नहीं? टाइप करें")}</button>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.slice(0, 30).map((i) => (
          <li key={i.id}>
            <button onClick={() => setPicked(i)} className="flex w-full items-center gap-3 border border-border bg-canvas-card p-2 text-left hover:border-ink">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.imageUrl ? <img src={i.imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" /> : <Zap className="h-6 w-6 text-ink-light" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{i.title}</span>
                <span className="block font-mono text-[11px] text-ink-muted">{i.sku}</span>
                <StarBadge stars={i.stars} inverter={i.inverter} />
              </span>
              <span className="shrink-0 font-heading text-[16px] font-semibold tabular-nums">{inr(i.priceInr)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
