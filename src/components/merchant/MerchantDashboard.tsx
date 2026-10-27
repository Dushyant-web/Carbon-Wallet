"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Landmark, Leaf, PackagePlus, ScanLine, Store, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { shortMonth } from "@/lib/plainWords";

type Dashboard = {
  shop: { name: string; city: string; sells: string };
  kpis: {
    itemsThisMonth: number;
    itemsTotal: number;
    customers: number;
    scansThisMonth: number;
    efficientPct: number;
    rejected: number;
    schemesExplained: number;
    schemesApplied: number;
    catalogueItems: number;
    revenueInr: number;
  };
  byMonth: { month: string; items: number; efficient: number }[];
  topProducts: { title: string; sold: number }[];
  recent: { id: string; summary: string; status: string; at: string; carbonId: string | null }[];
};

const STATUS: Record<string, [string, string]> = {
  REGISTERED: ["On the home", "text-success-text"],
  REJECTED: ["Owner said not theirs", "text-critical-text"],
  REMOVED: ["Removed (sold / scrapped)", "text-ink-muted"],
};

/** The shop's home page: what it sold, how green, the scheme help it gave, and quick ways to the counter. */
export function MerchantDashboard() {
  const { lang, t } = useUiPrefs();
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["merchant", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/merchant/dashboard");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });
  if (isLoading || !data) return <Skeleton className="h-[480px] w-full" />;
  const k = data.kpis;
  const maxItems = Math.max(1, ...data.byMonth.map((m) => m.items));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="label-caps">{t("Shop dashboard", "दुकान डैशबोर्ड")}</span>
          <h1 className="mt-1.5 font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">{data.shop.name}</h1>
          <p className="text-[15px] text-ink-muted">{data.shop.city}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/merchant/counter" className="inline-flex h-12 items-center gap-2 rounded-md bg-gov-saffron px-5 text-[15px] font-semibold text-white hover:brightness-95">
            <ScanLine className="h-5 w-5" /> {t("Scan a customer's card", "ग्राहक का कार्ड स्कैन करें")}
          </Link>
          <Link href="/merchant/catalogue" className="inline-flex h-12 items-center gap-2 rounded-md border border-gov-navy px-5 text-[15px] font-semibold text-gov-navy hover:bg-gov-sky">
            <PackagePlus className="h-5 w-5" /> {t("Upload catalogue", "कैटलॉग अपलोड करें")}
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          [Store, t("Items this month", "इस महीने सामान"), k.itemsThisMonth, t(`${k.itemsTotal} in all`, `कुल ${k.itemsTotal}`)],
          [Users, t("Homes served", "घर"), k.customers, t(`${k.scansThisMonth} card scans this month`, `इस महीने ${k.scansThisMonth} स्कैन`)],
          [Leaf, t("Efficient share", "कुशल हिस्सा"), `${k.efficientPct}%`, t("5-star, inverter or electric", "5-स्टार, इन्वर्टर या इलेक्ट्रिक")],
          [Landmark, t("Scheme help given", "योजना मदद"), k.schemesExplained, t(`${k.schemesApplied} applied`, `${k.schemesApplied} आवेदन`)],
          [PackagePlus, t("Products in catalogue", "कैटलॉग में उत्पाद"), k.catalogueItems, t("shown at the counter", "काउंटर पर")],
          [Store, t("Turned down by homes", "घरों ने अस्वीकारा"), k.rejected, t("keep this at 0", "इसे 0 रखें")],
        ].map(([Icon, label, value, sub], i) => {
          const I = Icon as typeof Store;
          return (
            <div key={i} className="border border-border bg-canvas-card p-4">
              <I className="h-5 w-5 text-gov-blue" />
              <p className="mt-2 text-[12.5px] text-ink-muted">{label as string}</p>
              <p className="font-heading text-3xl font-medium tabular-nums">{value as React.ReactNode}</p>
              <p className="text-[11.5px] text-ink-muted">{sub as string}</p>
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="border border-border bg-canvas-card p-5">
          <h2 className="font-heading text-xl font-medium">{t("Items registered, last 6 months", "पिछले 6 महीनों में दर्ज सामान")}</h2>
          <p className="text-[13px] text-ink-muted">{t("The green part is efficient items.", "हरा हिस्सा कुशल सामान है।")}</p>
          <div className="mt-5 flex h-44 items-end gap-3 border-b border-ink">
            {data.byMonth.map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col justify-end">
                <span className="mb-1 text-center text-[12px] tabular-nums">{m.items}</span>
                <div className="flex flex-col justify-end bg-gov-navy" style={{ height: `${Math.max(2, (m.items / maxItems) * 85)}%` }}>
                  <div className="bg-success" style={{ height: `${m.items ? (m.efficient / m.items) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            {data.byMonth.map((m) => (
              <span key={m.month} className="flex-1 text-center text-[12px] text-ink-muted">{shortMonth(m.month, lang)}</span>
            ))}
          </div>
        </section>

        <section className="border border-border bg-canvas-card p-5">
          <h2 className="font-heading text-xl font-medium">{t("Recent registrations", "हाल में दर्ज")}</h2>
          {data.recent.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-muted">{t("Nothing yet. Scan a customer's Carbon Card to register what they bought.", "अभी कुछ नहीं।")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <span className="block truncate">{r.summary}</span>
                    <span className="font-mono text-[11px] text-ink-muted">{r.carbonId ?? "—"} · {new Date(r.at).toLocaleDateString("en-IN")}</span>
                  </span>
                  <span className={`shrink-0 text-[12px] font-semibold ${STATUS[r.status]?.[1] ?? ""}`}>{STATUS[r.status]?.[0] ?? r.status}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/merchant/sales" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-gov-blue underline">
            {t("All registered items", "सारा दर्ज सामान")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {data.topProducts.length > 0 && (
            <>
              <h3 className="mt-5 font-heading text-lg font-medium">{t("Best-selling catalogue products", "सबसे ज़्यादा बिके उत्पाद")}</h3>
              <ul className="mt-2 text-[14px]">
                {data.topProducts.map((p) => (
                  <li key={p.title} className="flex justify-between border-b border-border/60 py-1.5">
                    <span className="truncate">{p.title}</span>
                    <span className="tabular-nums text-ink-muted">{p.sold}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <p className="border-l-4 border-gov-green bg-gov-greenSoft px-4 py-3 text-[14px]">
        {t(
          "Every item you register is sealed on the blockchain each night, and homes see your shop's name on it. Telling customers about government benefits is recorded too: it counts toward your shop's green record.",
          "आप जो भी सामान दर्ज करते हैं वह हर रात ब्लॉकचेन पर सील होता है और घरों को आपकी दुकान का नाम दिखता है। ग्राहकों को सरकारी लाभ बताना भी दर्ज होता है।",
        )}
      </p>
    </div>
  );
}
