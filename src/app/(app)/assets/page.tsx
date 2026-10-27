"use client";

import { GRID_KG_CO2E_PER_KWH } from "@/lib/ghg";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, Camera, Car, Clock, CreditCard, Fan, Flame, Package, Pencil, Refrigerator, Snowflake, Store, Sun, Trash2, WashingMachine, Zap } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { HowCalculated } from "@/components/ui/HowCalculated";
import { Pager, usePaged } from "@/components/ui/Pager";
import { Skeleton } from "@/components/ui/Skeleton";
import { CardItemsTabs } from "@/components/assets/CardItemsTabs";
import { RemovalDialog, type RemovalTarget } from "@/components/assets/RemovalDialog";
import { APPLIANCE_TYPES, RATINGS, VEHICLE_TYPES, labelOf } from "@/lib/assets";
import type { LucideIcon } from "lucide-react";

const GRID_EF = GRID_KG_CO2E_PER_KWH; // kg CO₂e per kWh (CEA 2025-26 + CH₄, N₂O)
const FUEL_EF: Record<string, number> = { Petrol: 2.31, Diesel: 2.68, CNG: 2.75, Hybrid: 2.31 }; // kg per litre (CNG per kg)
const FUEL_UNIT: Record<string, string> = { Petrol: "L", Diesel: "L", CNG: "kg", Hybrid: "L", Electric: "kWh" };

// Registered by a shop at the counter (merchant.service.ts): the shop's specs are locked, usage stays the household's
type RegisteredBy = { shop: string; city: string; at: string; product?: string | null; imageUrl?: string | null; priceInr?: number | null } | null;
type Appliance = { id: string; name: string; type: string; rating: string; powerKw: number; avgHoursPerDay?: number; source?: string; registeredBy?: RegisteredBy };
type Vehicle = { id: string; name: string; type: string; fuel: string; monthlyKm: number; kmPerUnit?: number; year?: number | null; source?: string; registeredBy?: RegisteredBy };
type Removal = {
  id: string;
  kind: string;
  itemId: string | null;
  itemSummary: string;
  shopName: string | null;
  reason: string;
  note: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  photoIds: string[];
};

const RECENT_DAYS = 14;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const APPLIANCE_ICON: Record<string, LucideIcon> = { AC: Snowflake, Refrigerator, WashingMachine, SolarPV: Sun, WaterHeater: Flame, Fan };
const REASON_WORDS: Record<string, [string, string]> = {
  BROKEN: ["Broken", "ख़राब"],
  SOLD: ["Sold", "बेचा"],
  GIVEN_AWAY: ["Given away", "दे दिया"],
  SCRAPPED: ["Scrapped", "कबाड़"],
  NEVER_HAD: ["Never had it", "कभी नहीं था"],
  NOT_OURS: ["Shop's mistake", "दुकान की ग़लती"],
};

const applianceKg = (a: Appliance) => a.powerKw * (a.avgHoursPerDay ?? 0) * 30 * GRID_EF;
function vehicleKg(v: Vehicle) {
  if (!v.kmPerUnit || v.kmPerUnit <= 0 || v.type === "PublicTransit") return null;
  const units = v.monthlyKm / v.kmPerUnit;
  return v.fuel === "Electric" ? units * GRID_EF : units * (FUEL_EF[v.fuel] ?? 2.31);
}

export default function ItemsPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data, isLoading } = useHouseholdOverview(activeHouseholdId);
  const { can } = usePermissions();
  const { lang, t } = useUiPrefs();
  const qc = useQueryClient();
  const [removing, setRemoving] = useState<{ target: RemovalTarget; reason?: "NOT_OURS" } | null>(null);
  const [editing, setEditing] = useState<{ kind: "appliance" | "vehicle"; item: Appliance | Vehicle } | null>(null);
  const removals = useQuery<{ requests: Removal[] }>({
    queryKey: ["household", activeHouseholdId, "removals"],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/removals`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("removals unavailable");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });
  // one list of everything the home owns, 20 to a page
  const allItems = useMemo(
    () => [
      ...((data?.appliances ?? []) as Appliance[]).map((item) => ({ kind: "APPLIANCE" as const, item })),
      ...((data?.vehicles ?? []) as Vehicle[]).map((item) => ({ kind: "VEHICLE" as const, item })),
    ],
    [data],
  );
  const itemPages = usePaged(allItems);
  const requestPages = usePaged(removals.data?.requests ?? []);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <CardItemsTabs />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const appliances: Appliance[] = data.appliances;
  const vehicles: Vehicle[] = data.vehicles;
  const isOwner = can("asset:delete");
  const requests = removals.data?.requests ?? [];
  const pendingFor = new Set(requests.filter((r) => r.status === "PENDING").map((r) => r.itemId));
  const since = Date.now() - RECENT_DAYS * 86_400_000;
  const fromShops = [
    ...appliances.map((a) => ({ kind: "APPLIANCE" as const, item: a })),
    ...vehicles.map((v) => ({ kind: "VEHICLE" as const, item: v })),
  ].filter(({ item }) => item.registeredBy && new Date(item.registeredBy.at).getTime() >= since && !pendingFor.has(item.id));
  const monthlyKg = appliances.filter((a) => a.type !== "SolarPV").reduce((s, a) => s + applianceKg(a), 0) + vehicles.reduce((s, v) => s + (vehicleKg(v) ?? 0), 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["household", activeHouseholdId] });
  };

  async function saveUsage(kind: "appliance" | "vehicle", id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/households/${activeHouseholdId}/${kind}s/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-demo-role": demoRole },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? t("Couldn't save", "सेव नहीं हुआ"));
    toast.success(t("Saved. Your estimates are updated.", "सेव हो गया। अनुमान बदल गए।"));
    setEditing(null);
    refresh();
  }

  const ask = (kind: "APPLIANCE" | "VEHICLE", item: Appliance | Vehicle, reason?: "NOT_OURS") =>
    setRemoving({ target: { kind, id: item.id, name: item.name, fromShop: !!item.registeredBy }, reason });

  return (
    <div className="flex flex-col gap-8">
      <CardItemsTabs />

      <header>
        <h1 className="font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">{t("What your home owns", "आपके घर का सामान")}</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
          {t(
            "Shops add an item when you buy it and show your Carbon Card. Each one shows roughly how much carbon it makes in a month.",
            "जब आप कुछ ख़रीदकर दुकान पर अपना कार्बन कार्ड दिखाते हैं, दुकान उसे यहाँ जोड़ती है। हर सामान का महीने का अनुमानित कार्बन दिखता है।",
          )}
        </p>
      </header>

      {/* How items get here */}
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [CreditCard, t("Show your card at the shop", "दुकान पर कार्ड दिखाएँ")],
          [Store, t("The shop adds what you bought", "दुकान सामान जोड़ती है")],
          [Package, t("It appears here, with a notification", "यहाँ दिखेगा, सूचना के साथ")],
        ].map(([Icon, text], i) => {
          const I = Icon as LucideIcon;
          return (
            <li key={i} className="flex items-center gap-3 border border-border bg-canvas-card px-4 py-3 text-[14px]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-canvas-card">{i + 1}</span>
              <I className="h-5 w-5 shrink-0 text-ink-muted" />
              <span>{text as string}</span>
            </li>
          );
        })}
      </ol>

      {fromShops.length > 0 && (
        <section aria-label={t("New from shops", "दुकानों से नया")} className="border-l-4 border-secondary bg-canvas-card px-5 py-4">
          <p className="text-[15px] font-semibold">{t("New from shops", "दुकानों से नया")}</p>
          <ul className="mt-2">
            {fromShops.map(({ kind, item }) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 py-2.5 text-[14px] last:border-b-0">
                <span>
                  <span className="font-medium">{item.name}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {item.registeredBy!.shop}, {item.registeredBy!.city} · {shortDate(item.registeredBy!.at)}
                  </span>
                </span>
                {isOwner && (
                  <button onClick={() => ask(kind, item, "NOT_OURS")} className="h-10 rounded-md border border-border px-3 text-[13px] font-medium hover:border-critical hover:text-critical-text">
                    {t("Not ours", "हमारा नहीं")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!isOwner && <p className="mt-2 text-[12px] text-ink-muted">{t("Something here isn't yours? Tell the owner of the home.", "कुछ आपका नहीं है? घर के मालिक को बताएँ।")}</p>}
        </section>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2">
        <h2 className="font-heading text-2xl font-medium">
          {t("Items", "सामान")} <span className="text-ink-muted">({appliances.length + vehicles.length})</span>
        </h2>
        <span className="text-[14px] text-ink-muted">
          {t("All together about", "कुल मिलाकर लगभग")} <strong className="text-ink">{Math.round(monthlyKg)} kg</strong> {t("a month", "हर महीने")}
        </span>
      </div>

      {appliances.length + vehicles.length === 0 ? (
        <p className="border border-border bg-canvas-card p-5 text-[15px] text-ink-muted">
          {t("Nothing yet. Show your Carbon Card when you buy an AC, fridge, scooter or car.", "अभी कुछ नहीं। एसी, फ़्रिज, स्कूटर या कार ख़रीदते समय कार्बन कार्ड दिखाएँ।")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {itemPages.slice.map(({ kind, item }) => {
            if (kind === "APPLIANCE") {
              const a = item as Appliance;
              const Icon = APPLIANCE_ICON[a.type] ?? Zap;
              return (
                <ItemCard
                  key={a.id}
                  Icon={Icon}
                  name={a.name}
                  kind={labelOf(APPLIANCE_TYPES, a.type)}
                  facts={[labelOf(RATINGS, a.rating), `${a.powerKw} kW`, `${a.avgHoursPerDay ?? 0} ${t("h a day", "घंटे रोज़")}`]}
                  kg={a.type === "SolarPV" ? null : applianceKg(a)}
                  solar={a.type === "SolarPV"}
                  by={a.registeredBy}
                  pending={pendingFor.has(a.id)}
                  canAct={isOwner}
                  onEdit={() => setEditing({ kind: "appliance", item: a })}
                  onRemove={() => ask("APPLIANCE", a)}
                  t={t}
                />
              );
            }
            const v = item as Vehicle;
            return (
              <ItemCard
                key={v.id}
                Icon={v.type === "TwoWheeler" ? Bike : Car}
                name={v.name}
                kind={`${labelOf(VEHICLE_TYPES, v.type)}${v.year ? ` · ${v.year}` : ""}`}
                facts={[v.fuel, v.kmPerUnit ? `${v.kmPerUnit} km/${FUEL_UNIT[v.fuel] ?? "L"}` : "", `${v.monthlyKm} ${t("km a month", "किमी/माह")}`].filter(Boolean)}
                kg={vehicleKg(v)}
                by={v.registeredBy}
                pending={pendingFor.has(v.id)}
                canAct={isOwner}
                onEdit={() => setEditing({ kind: "vehicle", item: v })}
                onRemove={() => ask("VEHICLE", v)}
                t={t}
              />
            );
          })}
        </div>
      )}
      <Pager page={itemPages.page} pages={itemPages.pages} total={itemPages.total} onPage={itemPages.setPage} />

      {isOwner && vehicles.length > 0 && (
        <Link href="/assets/fuel" className="inline-flex h-11 w-fit items-center gap-2 rounded-md border border-border bg-canvas-card px-4 text-[14px] font-medium hover:border-ink">
          <Camera className="h-4 w-4" /> {t("Add fuel from a pump photo", "पंप की फ़ोटो से ईंधन जोड़ें")}
        </Link>
      )}

      <HowCalculated>
        {t(
          "Appliances: label power × hours a day × 30 days × 0.678 kg CO₂e per unit (CEA grid factor with CH₄ and N₂O). Vehicles: km ÷ mileage × fuel factor (petrol 2.31 kg/L, diesel 2.68, CNG 2.75/kg). Your real total comes from your bills.",
          "उपकरण: लेबल की पावर × रोज़ के घंटे × 30 दिन × 0.678 किलो CO₂e प्रति यूनिट। गाड़ी: किमी ÷ माइलेज × ईंधन फ़ैक्टर। असली कुल आपके बिल से आता है।",
        )}
      </HowCalculated>

      {/* Removal requests */}
      {requests.length > 0 && (
        <section aria-labelledby="req-h">
          <h2 id="req-h" className="font-heading text-2xl font-medium">{t("Removal requests", "हटाने के अनुरोध")}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {requestPages.slice.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 border border-border bg-canvas-card p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{r.itemSummary}</p>
                  <p className="text-[13px] text-ink-muted">
                    {(REASON_WORDS[r.reason] ?? [r.reason, r.reason])[lang === "hi" ? 1 : 0]} · {shortDate(r.createdAt)}
                  </p>
                  <p className="mt-1 text-[14px]">“{r.note}”</p>
                  {r.decisionNote && <p className="mt-1 text-[13px] text-ink-muted">{t("Our team:", "हमारी टीम:")} {r.decisionNote}</p>}
                  {r.photoIds.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {r.photoIds.map((pid) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={pid} src={`/api/households/${activeHouseholdId}/removals/${r.id}/photos/${pid}`} alt="" className="h-16 w-16 border border-border object-cover" loading="lazy" />
                      ))}
                    </div>
                  )}
                </div>
                <StatusChip status={r.status} t={t} />
              </li>
            ))}
          </ul>
          <Pager page={requestPages.page} pages={requestPages.pages} total={requestPages.total} onPage={requestPages.setPage} />
        </section>
      )}

      {removing && (
        <RemovalDialog
          householdId={activeHouseholdId}
          demoRole={demoRole}
          target={removing.target}
          initialReason={removing.reason}
          onClose={() => setRemoving(null)}
          onSent={() => {
            setRemoving(null);
            qc.invalidateQueries({ queryKey: ["household", activeHouseholdId, "removals"] });
          }}
        />
      )}
      {editing && <UsageDialog editing={editing} onClose={() => setEditing(null)} onSave={saveUsage} t={t} />}
    </div>
  );
}

function ItemCard({
  Icon,
  name,
  kind,
  facts,
  kg,
  solar = false,
  by,
  pending,
  canAct,
  onEdit,
  onRemove,
  t,
}: {
  Icon: LucideIcon;
  name: string;
  kind: string;
  facts: string[];
  kg: number | null;
  solar?: boolean;
  by?: RegisteredBy;
  pending: boolean;
  canAct: boolean;
  onEdit: () => void;
  onRemove: () => void;
  t: (en: string, hi: string) => string;
}) {
  return (
    <article className="flex flex-col border border-border bg-canvas-card">
      <div className="flex items-start gap-3 p-4">
        {by?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={by.imageUrl} alt={by.product ?? name} className="h-14 w-14 shrink-0 border border-border bg-white object-contain" loading="lazy" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-canvas-subtle">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{name}</p>
          <p className="text-[13px] text-ink-muted">{kind}</p>
        </div>
        <div className="text-right">
          {solar ? (
            <span className="text-[13px] font-semibold text-success-text">{t("Makes power", "बिजली बनाता है")}</span>
          ) : (
            <>
              <span className="block text-xl font-semibold tabular-nums">{kg === null ? "—" : Math.round(kg)}</span>
              <span className="text-[11px] text-ink-muted">{t("kg a month", "किलो/माह")}</span>
            </>
          )}
        </div>
      </div>
      <p className="px-4 text-[13px] text-ink-muted">{facts.join(" · ")}</p>
      {by && (
        <p className="mt-1 flex items-center gap-1.5 px-4 text-[12px] text-ink-muted">
          <Store className="h-3.5 w-3.5" /> {t("Added by", "जोड़ा")} {by.shop} · {shortDate(by.at)}
          {by.priceInr ? ` · ₹${by.priceInr.toLocaleString("en-IN")}` : ""}
        </p>
      )}
      <div className="h-3" />
      <div className="mt-auto flex items-center gap-1 border-t border-border px-2 py-1">
        {pending ? (
          <span className="flex h-10 items-center gap-1.5 px-2 text-[13px] font-medium text-warning-text">
            <Clock className="h-4 w-4" /> {t("Removal asked · waiting for our team", "हटाने का अनुरोध · जाँच जारी")}
          </span>
        ) : (
          canAct && (
            <>
              <button onClick={onEdit} className="flex h-10 items-center gap-1.5 rounded-md px-2.5 text-[13px] hover:bg-canvas-subtle">
                <Pencil className="h-4 w-4" /> {t("Change use", "इस्तेमाल बदलें")}
              </button>
              <button onClick={onRemove} className="ml-auto flex h-10 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink-muted hover:bg-critical-subtle hover:text-critical-text">
                <Trash2 className="h-4 w-4" /> {t("Ask to remove", "हटाने को कहें")}
              </button>
            </>
          )
        )}
      </div>
    </article>
  );
}

function StatusChip({ status, t }: { status: Removal["status"]; t: (en: string, hi: string) => string }) {
  const map = {
    PENDING: ["border-warning-border bg-warning-subtle text-warning-text", t("Waiting", "जाँच जारी")],
    APPROVED: ["border-success-border bg-success-subtle text-success-text", t("Removed", "हटाया गया")],
    REJECTED: ["border-critical-border bg-critical-subtle text-critical-text", t("Not approved", "मंज़ूर नहीं")],
  } as const;
  const [cls, label] = map[status];
  return <span className={`h-fit shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold ${cls}`}>{label}</span>;
}

/** Only how an item is used can change: the specs come from the label or the invoice. */
function UsageDialog({
  editing,
  onClose,
  onSave,
  t,
}: {
  editing: { kind: "appliance" | "vehicle"; item: Appliance | Vehicle };
  onClose: () => void;
  onSave: (kind: "appliance" | "vehicle", id: string, body: Record<string, unknown>) => void;
  t: (en: string, hi: string) => string;
}) {
  const isAppliance = editing.kind === "appliance";
  const [name, setName] = useState(editing.item.name);
  const [use, setUse] = useState(String(isAppliance ? ((editing.item as Appliance).avgHoursPerDay ?? 4) : (editing.item as Vehicle).monthlyKm));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t("Change use", "इस्तेमाल बदलें")}
        className="w-full max-w-md bg-canvas-card p-5 shadow-tier-3 sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(editing.kind, editing.item.id, isAppliance ? { name, avgHoursPerDay: Number(use) } : { name, monthlyKm: Number(use) });
        }}
      >
        <h2 className="font-heading text-2xl font-medium">{t("Change use", "इस्तेमाल बदलें")}</h2>
        <p className="text-[13px] text-ink-muted">{t("The label details stay as the shop entered them.", "लेबल की जानकारी दुकान वाली ही रहेगी।")}</p>
        <label className="mt-4 block text-[14px] font-semibold">
          {t("Name", "नाम")}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="mt-1 h-12 w-full rounded-sm border border-border px-3 text-[15px] font-normal focus:border-ink focus:outline-none" />
        </label>
        <label className="mt-3 block text-[14px] font-semibold">
          {isAppliance ? t("Hours a day it runs", "रोज़ कितने घंटे चलता है") : t("Km a month", "महीने में कितने किमी")}
          <input
            value={use}
            onChange={(e) => setUse(e.target.value)}
            inputMode="decimal"
            className="mt-1 h-12 w-full rounded-sm border border-border px-3 text-[15px] font-normal focus:border-ink focus:outline-none"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-12 rounded-md border border-border px-5">{t("Cancel", "रद्द करें")}</button>
          <button type="submit" className="h-12 rounded-md bg-ink px-5 font-semibold text-canvas-card">{t("Save", "सेव करें")}</button>
        </div>
      </form>
    </div>
  );
}
