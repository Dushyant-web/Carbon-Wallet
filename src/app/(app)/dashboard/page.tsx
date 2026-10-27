"use client";

import { GRID_KG_CO2E_PER_KWH } from "@/lib/ghg";
import type { Lang } from "@/lib/languages";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Camera, CheckCircle2, CreditCard, Landmark, LayoutGrid, MapPinned, TrendingDown, TrendingUp, TriangleAlert, XCircle } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview, useHouseholds } from "@/hooks/useHousehold";
import { Welcome } from "@/components/dashboard/Welcome";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { HomeNudges } from "@/components/dashboard/HomeNudges";
import { NextMonthForecast } from "@/components/dashboard/NextMonthForecast";
import { GasBreakdown } from "@/components/dashboard/GasBreakdown";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { categoryColor } from "@/lib/viz";
import { ALLOWANCE_SOURCE, STATUS_WORDS, kgToAcDays, stateInfo, statusFor, type CarbonStatus } from "@/lib/allowance";
import { categoryWords, inr, monthWords, shortMonth } from "@/lib/plainWords";

type TrendPoint = {
  month: string;
  label: string;
  totalKg: number | null;
  partial: boolean;
  billedDays: number | null;
  daysInMonth: number | null;
  isReporting: boolean;
};

const TONE: Record<CarbonStatus, { bar: string; soft: string; text: string; border: string; Icon: typeof CheckCircle2 }> = {
  GREEN: { bar: "bg-success", soft: "bg-success-subtle", text: "text-success-text", border: "border-success-border", Icon: CheckCircle2 },
  AMBER: { bar: "bg-warning", soft: "bg-warning-subtle", text: "text-warning-text", border: "border-warning-border", Icon: TriangleAlert },
  RED: { bar: "bg-critical", soft: "bg-critical-subtle", text: "text-critical-text", border: "border-critical-border", Icon: XCircle },
};

export default function HomePage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const households = useHouseholds();
  const { data, isLoading, error } = useHouseholdOverview(activeHouseholdId);
  const sealed = useQuery({
    queryKey: ["household", activeHouseholdId, "statements"],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/statements`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("proof service unavailable");
      return (await res.json()).statements as { period: string; anchored: boolean }[];
    },
    enabled: !!activeHouseholdId,
    retry: false,
  });
  const schemes = useQuery({
    queryKey: ["household", activeHouseholdId, "schemes"],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/schemes`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("schemes unavailable");
      return (await res.json()) as { forYou: { slug: string }[] };
    },
    enabled: !!activeHouseholdId,
  });
  const { can } = usePermissions();
  const { lang, t } = useUiPrefs();
  const queryClient = useQueryClient();
  const [committed, setCommitted] = useState(false);

  if (households.data && (households.data.households ?? []).length === 0) return <Welcome />;

  // "no data and no error yet" is loading too: that is what the server renders, so the first paint matches
  if (isLoading || (!data && !error)) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title={t("Couldn't load your home", "आपके घर की जानकारी नहीं खुली")}
        message={t("Please check your internet and try again, or pick another home at the top.", "इंटरनेट देखें और फिर से कोशिश करें।")}
      />
    );
  }

  const { household, kpi, trendHistory, categoryBreakdown, nextBestAction, period, access } = data;
  const trend: TrendPoint[] = trendHistory || [];
  const used: number = period.hasData ? kpi.totalEmissions : 0;
  // the yardstick comes from the server: the measured average of the state's homes this month, or the starting estimate
  const allowance: { allowanceKg: number; perPersonKg: number; source: "HOMES" | "ESTIMATE"; homes: number } = data.allowance;
  const ratio = allowance.allowanceKg > 0 ? used / allowance.allowanceKg : 0;
  const cs = { allowanceKg: allowance.allowanceKg, ratio, status: statusFor(used, allowance.allowanceKg), state: stateInfo(household.state) };
  const tone = TONE[cs.status];
  const words = STATUS_WORDS[cs.status];
  const stateName = lang === "hi" ? cs.state.nameHi : cs.state.name;
  const monthName = monthWords(period.month, lang);
  const pctOfAllowance = Math.round(cs.ratio * 100);
  const categories = Object.entries(categoryBreakdown as Record<string, number>)
    .filter(([, kg]) => kg > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = categories.reduce((a, [, kg]) => a + kg, 0) || 1;
  const top = categories[0];
  const electricityKg = categories.filter(([c]) => /electric/i.test(c)).reduce((a, [, kg]) => a + kg, 0);
  const canCommit = can("recommendation:apply");
  const isCommitted = committed || nextBestAction?.status === "ACCEPTED";
  const forYou = schemes.data?.forYou.length ?? 0;

  async function commit() {
    if (!nextBestAction?.id) return;
    const res = await fetch(`/api/households/${household.id}/recommendations/${nextBestAction.id}/apply`, {
      method: "POST",
      headers: { "x-demo-role": demoRole },
    });
    if (res.ok) {
      setCommitted(true);
      toast.success(t("Saved. We'll check your next bill to see the saving.", "सेव हो गया। अगले बिल में बचत देखेंगे।"));
      queryClient.invalidateQueries({ queryKey: ["household", household.id] });
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? t("Couldn't save. Please try again.", "सेव नहीं हुआ। फिर कोशिश करें।"));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <span className="label-caps">{t("My home", "मेरा घर")}</span>
        <h1 className="font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">{household.name}</h1>
        <p className="text-[15px] text-ink-muted">
          {[household.city, stateName].filter(Boolean).join(", ")} · {household.size} {t("people", "लोग")}
        </p>
      </header>

      {/* 1 · One big number, one colour, one sentence */}
      <section aria-labelledby="status-h" className={`border ${tone.border} bg-canvas-card`}>
        <div className={`flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold ${tone.soft} ${tone.text}`}>
          <tone.Icon className="h-5 w-5 shrink-0" />
          <span id="status-h">{period.hasData ? (lang === "hi" ? words.hi : words.en) : t("No bill yet", "अभी कोई बिल नहीं")}</span>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-[1.1fr_1fr] md:p-7">
          <div>
            <p className="text-[15px] text-ink-muted">
              {t(`Your home's carbon in ${monthName}`, `${monthName} में आपके घर का कार्बन`)}
              {period.isPartial ? t(" (so far)", " (अब तक)") : ""}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-heading text-6xl font-medium leading-none tracking-tight tabular-nums md:text-7xl">
                {period.hasData ? Math.round(used) : "—"}
              </span>
              <span className="text-lg text-ink-muted">{t("kg CO₂e", "किलो CO₂e")}</span>
            </p>
            {period.hasData ? (
              <p className="mt-3 max-w-md text-[15px] leading-relaxed">
                {t(
                  `That's ${pctOfAllowance}% of the ${stateName} average for a home of ${household.size}.`,
                  `यह ${household.size} लोगों के घर के ${stateName} औसत का ${pctOfAllowance}% है।`,
                )}{" "}
                {top &&
                  t(
                    `Most of it (${Math.round((top[1] / total) * 100)}%) is ${categoryWords(top[0], "en").toLowerCase()}.`,
                    `सबसे ज़्यादा (${Math.round((top[1] / total) * 100)}%) ${categoryWords(top[0], "hi")} से।`,
                  )}
              </p>
            ) : (
              <p className="mt-3 max-w-md text-[15px] leading-relaxed">
                {t("Add your electricity bill. We read it and show your home's carbon here.", "अपना बिजली बिल डालें। हम उसे पढ़कर यहाँ दिखाएँगे।")}
              </p>
            )}
            {kpi.trendPct !== null && (
              <p className={`mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium ${kpi.trendPct <= 0 ? "text-success-text" : "text-critical-text"}`}>
                {kpi.trendPct <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                {kpi.trendPct <= 0
                  ? t(`${Math.abs(kpi.trendPct)}% less than last month`, `पिछले महीने से ${Math.abs(kpi.trendPct)}% कम`)
                  : t(`${kpi.trendPct}% more than last month`, `पिछले महीने से ${kpi.trendPct}% ज़्यादा`)}
              </p>
            )}
          </div>

          {/* meter: used vs the state average for this home */}
          <div className="flex flex-col justify-center gap-3">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink-muted">{t("Used", "इस्तेमाल")}</span>
              <span className="text-ink-muted">
                {t("State average for your home", "आपके घर के लिए राज्य औसत")}: <strong className="text-ink">{cs.allowanceKg} kg</strong>
              </span>
            </div>
            <Meter pct={period.hasData ? pctOfAllowance : 0} status={cs.status} />
            <ul className="grid grid-cols-2 gap-3 pt-1 text-[13px]">
              <li className="border-l-2 border-border pl-3">
                <span className="block text-ink-muted">{t("Electricity cost (approx.)", "बिजली का ख़र्च (लगभग)")}</span>
                <span className="text-lg font-semibold tabular-nums">{electricityKg ? inr((electricityKg / GRID_KG_CO2E_PER_KWH) * 7) : "—"}</span>
              </li>
              <li className="border-l-2 border-border pl-3">
                <span className="block text-ink-muted">{t("Same as running a 1.5-ton AC", "1.5 टन एसी चलाने जितना")}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {period.hasData ? `${kgToAcDays(used)} ${t("days", "दिन")}` : "—"}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* one action */}
        {nextBestAction && (
          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
            <div>
              <span className="label-caps text-secondary">{t("Do this one thing", "बस यह एक काम करें")}</span>
              <p className="mt-1 text-[16px] font-semibold">{nextBestAction.action}</p>
              <p className="text-[14px] text-ink-muted">
                {t("Saves about", "लगभग बचत")} <strong className="text-ink">{inr(Number(nextBestAction.inrSaved))}</strong> {t("and", "और")}{" "}
                <strong className="text-ink">{nextBestAction.kgSaved} kg</strong> {t("a month", "हर महीने")}
              </p>
            </div>
            {canCommit ? (
              <Button size="lg" variant={isCommitted ? "secondary" : "primary"} disabled={isCommitted || !nextBestAction.id} onClick={commit}>
                {isCommitted ? t("I'm doing this ✓", "कर रहे हैं ✓") : t("I'll do this", "मैं यह करूँगा")}
              </Button>
            ) : (
              <Link href="/actions" className="text-[14px] font-medium underline underline-offset-2">
                {t("See all ways to save", "बचत के सभी तरीके")}
              </Link>
            )}
          </div>
        )}
      </section>

      {/* 2 · What next month will probably look like (machine-learned) */}
      <NextMonthForecast householdId={activeHouseholdId} demoRole={demoRole} />

      {/* 3 · Two simple graphs */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="border border-border bg-canvas-card p-5 md:p-6">
          <h2 className="font-heading text-xl font-medium">{t("Last 6 months", "पिछले 6 महीने")}</h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            {t("Each bar is one month. The dotted line is the state average for your home.", "हर डंडा एक महीना है। बिंदु वाली रेखा आपके घर का राज्य औसत है।")}
          </p>
          <MonthBars trend={trend} allowance={cs.allowanceKg} lang={lang} t={t} />
        </section>

        <section className="border border-border bg-canvas-card p-5 md:p-6">
          <h2 className="font-heading text-xl font-medium">{t("Where it went", "कहाँ से आया")}</h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            {t(`What made your carbon in ${monthName}. The AC is part of electricity.`, `${monthName} में कार्बन किससे बना। एसी बिजली में गिना है।`)}
          </p>
          {categories.length === 0 ? (
            <p className="mt-6 text-[14px] text-ink-muted">{t("Nothing yet.", "अभी कुछ नहीं।")}</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-4">
              {categories.map(([cat, kg]) => {
                const pct = Math.round((kg / total) * 100);
                return (
                  <li key={cat}>
                    <div className="flex items-baseline justify-between text-[14px]">
                      <span className="font-medium">{categoryWords(cat, lang)}</span>
                      <span className="tabular-nums text-ink-muted">
                        <strong className="text-ink">{pct}%</strong> · {Math.round(kg)} kg
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full bg-canvas-subtle">
                      <div className="h-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: categoryColor(cat) }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {data.gasBreakdown && <GasBreakdown gases={data.gasBreakdown} monthName={monthName} />}

      <HomeNudges hasData={period.hasData} />
      {data.setup && <GettingStarted setup={data.setup} sealed={(sealed.data ?? []).some((x) => x.anchored)} />}

      {/* 3 · Big tiles to the other places */}
      <nav aria-label={t("Go to", "यहाँ जाएँ")} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {access?.canAddBills && <Tile href="/bills/new" Icon={Camera} title={t("Add a bill", "बिल डालें")} sub={t("Take a photo", "फ़ोटो खींचें")} accent />}
        <Tile href="/yojana" Icon={Landmark} title={t("Govt schemes", "सरकारी योजना")} sub={forYou ? t(`${forYou} for your home`, `आपके लिए ${forYou}`) : t("Subsidies & free help", "सब्सिडी और मदद")} />
        <Tile href="/mohalla" Icon={MapPinned} title={t("My mohalla", "मोहल्ला")} sub={t("Area, weather, air", "इलाका, मौसम, हवा")} />
        <Tile href="/assets" Icon={CreditCard} title={t("Card & items", "कार्ड और सामान")} sub={t("Show at shops", "दुकान पर दिखाएँ")} />
        {!access?.canAddBills && <Tile href="/reports" Icon={LayoutGrid} title={t("Monthly report", "मासिक रिपोर्ट")} sub={t("One page", "एक पेज")} />}
      </nav>

      <p className="font-mono text-[11px] leading-relaxed text-ink-muted">
        {t("How the state average is set:", "राज्य औसत कैसे तय होता है:")}{" "}
        {allowance.source === "HOMES"
          ? t(
              `the measured average of ${allowance.homes} Carbon Wallet homes in ${cs.state.name} this month (${allowance.perPersonKg} kg per person), times the people in your home.`,
              `इस महीने ${cs.state.nameHi} के ${allowance.homes} Carbon Wallet घरों का मापा हुआ औसत (${allowance.perPersonKg} किलो प्रति व्यक्ति), आपके घर के लोगों से गुणा।`,
            )
          : ALLOWANCE_SOURCE}{" "}
        <Link href="/how-we-calculate" className="underline underline-offset-2">
          {t("More", "और")}
        </Link>
      </p>
    </div>
  );
}

function Meter({ pct, status }: { pct: number; status: CarbonStatus }) {
  // the bar spans 0–200 % of the average; the 100 % mark is the average
  const width = Math.min(100, pct / 2);
  return (
    <div>
      <div className="relative h-6 w-full bg-canvas-subtle" role="meter" aria-valuemin={0} aria-valuemax={200} aria-valuenow={pct} aria-label="Used vs state average">
        <div className={`h-full ${TONE[status].bar}`} style={{ width: `${width}%` }} />
        <span className="absolute inset-y-[-4px] left-1/2 w-[2px] bg-ink" aria-hidden />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-muted">
        <span>0</span>
        <span className="font-semibold text-ink">{pct}%</span>
        <span>200%</span>
      </div>
    </div>
  );
}

function MonthBars({ trend, allowance, lang, t }: { trend: TrendPoint[]; allowance: number; lang: Lang; t: (en: string, hi: string) => string }) {
  const max = Math.max(allowance, ...trend.map((p) => p.totalKg ?? 0), 1) * 1.15;
  const linePct = (allowance / max) * 100;
  return (
    <div className="mt-5">
      <div className="relative flex h-56 items-end gap-2 border-b border-ink sm:gap-3">
        <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink/60" style={{ bottom: `${linePct}%` }} aria-hidden>
          <span className="absolute -top-5 right-0 bg-canvas-card px-1 font-mono text-[10.5px] text-ink-muted">
            {t("average", "औसत")} {allowance} kg
          </span>
        </div>
        {trend.map((pt) => {
          if (pt.totalKg === null) {
            return (
              <div key={pt.month} className="flex h-full flex-1 flex-col justify-end">
                <span className="mb-1 text-center text-[10.5px] text-ink-light">{t("no bill", "बिल नहीं")}</span>
              </div>
            );
          }
          const st = statusFor(pt.totalKg, allowance);
          return (
            <div key={pt.month} className="flex h-full flex-1 flex-col justify-end">
              <span className={`mb-1 text-center text-[12px] tabular-nums ${pt.isReporting ? "font-bold" : "text-ink-muted"}`}>{Math.round(pt.totalKg)}</span>
              <div
                className={`${TONE[st].bar} ${pt.partial ? "opacity-50" : ""} ${pt.isReporting ? "ring-2 ring-ink ring-offset-1" : ""}`}
                style={{ height: `${Math.max(3, (pt.totalKg / max) * 100)}%` }}
                title={`${pt.label}: ${pt.totalKg} kg`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {trend.map((pt) => (
          <span key={pt.month} className={`flex-1 text-center text-[12px] ${pt.isReporting ? "font-semibold" : "text-ink-muted"}`}>
            {shortMonth(pt.month, lang)}
          </span>
        ))}
      </div>
      {trend.some((p) => p.partial) && (
        <p className="mt-3 text-[12px] text-ink-muted">{t("Faded bars: the bill covers only part of that month.", "हल्के डंडे: बिल उस महीने का कुछ ही हिस्सा बताता है।")}</p>
      )}
    </div>
  );
}

function Tile({ href, Icon, title, sub, accent = false }: { href: string; Icon: typeof Camera; title: string; sub: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex min-h-[112px] flex-col justify-between border p-4 transition-colors ${
        accent ? "border-secondary bg-secondary text-white hover:bg-secondary-hover" : "border-border bg-canvas-card hover:border-ink"
      }`}
    >
      <Icon className="h-6 w-6" />
      <span>
        <span className="flex items-center gap-1 text-[15px] font-semibold">
          {title} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className={`text-[13px] ${accent ? "text-white/85" : "text-ink-muted"}`}>{sub}</span>
      </span>
    </Link>
  );
}
