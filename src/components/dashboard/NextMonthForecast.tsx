"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit } from "lucide-react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { monthWords } from "@/lib/plainWords";

type Forecast = {
  month: string;
  last_month: string;
  last_kg: number;
  kg: number;
  low_kg: number;
  high_kg: number;
  change_kg: number;
  reasons: { label: string; label_hi: string; kg: number }[];
  weather: string;
  model: { trainedAt: string; beatsBaseline: boolean; maeKg: number | null; baselineMaeKg: number | null };
} | null;

/** "Next month: about 323 kg (319–359)", and the reasons in kg, from the machine-learned model. */
export function NextMonthForecast({ householdId, demoRole }: { householdId: string; demoRole: string }) {
  const { t, lang } = useUiPrefs();
  const { data, isLoading } = useQuery<{ forecast: Forecast; unavailable?: string }>({
    queryKey: ["household", householdId, "prediction"],
    queryFn: async () => {
      const res = await fetch(`/api/households/${householdId}/prediction`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("forecast unavailable");
      return res.json();
    },
    enabled: !!householdId,
    staleTime: 30 * 60_000,
    retry: false,
  });
  const f = data?.forecast;
  if (isLoading) return <section className="h-56 animate-pulse border border-border bg-canvas-subtle" aria-busy="true" />;
  if (!f) return null;

  const up = f.change_kg > 0;
  const max = Math.max(...f.reasons.map((r) => Math.abs(r.kg)), 1);
  return (
    <section className="border border-border bg-canvas-card p-5 md:p-6" aria-labelledby="fc-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="label-caps flex items-center gap-1.5">
            <BrainCircuit className="h-4 w-4 text-gov-blue" /> {t("AI forecast", "AI अनुमान")}
          </span>
          <h2 id="fc-h" className="mt-1 font-heading text-xl font-medium">
            {t(`${monthWords(f.month, lang)}: about ${Math.round(f.kg)} kg CO₂e`, `${monthWords(f.month, lang)}: लगभग ${Math.round(f.kg)} किलो CO₂e`)}
          </h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            {t(`Likely between ${Math.round(f.low_kg)} and ${Math.round(f.high_kg)} kg.`, `शायद ${Math.round(f.low_kg)} से ${Math.round(f.high_kg)} किलो के बीच।`)}{" "}
            {up
              ? t(`That's ${Math.round(f.change_kg)} kg more than ${monthWords(f.last_month, lang, false)}.`, `${monthWords(f.last_month, lang, false)} से ${Math.round(f.change_kg)} किलो ज़्यादा।`)
              : t(`That's ${Math.round(-f.change_kg)} kg less than ${monthWords(f.last_month, lang, false)}.`, `${monthWords(f.last_month, lang, false)} से ${Math.round(-f.change_kg)} किलो कम।`)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${up ? "bg-warning-subtle text-warning-text" : "bg-success-subtle text-success-text"}`}>
          {up ? "▲" : "▼"} {Math.abs(Math.round(f.change_kg))} kg
        </span>
      </div>

      {f.reasons.length > 0 && (
        <>
          <h3 className="mt-4 text-[14px] font-semibold">{t("Why", "क्यों")}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {f.reasons.map((r) => (
              <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_120px_64px] items-center gap-2 text-[13.5px]">
                <span className="truncate">{lang === "hi" ? r.label_hi : r.label}</span>
                <span className="relative h-2.5 bg-canvas-subtle">
                  <span
                    className={`absolute top-0 h-full ${r.kg > 0 ? "left-1/2 bg-warning" : "right-1/2 bg-success"}`}
                    style={{ width: `${(Math.abs(r.kg) / max) * 50}%` }}
                  />
                  <span className="absolute left-1/2 top-[-2px] h-[14px] w-px bg-ink/40" aria-hidden />
                </span>
                <span className={`text-right font-mono tabular-nums ${r.kg > 0 ? "text-warning-text" : "text-success-text"}`}>
                  {r.kg > 0 ? "+" : "−"}
                  {Math.abs(r.kg).toFixed(0)} kg
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-muted">
        {t(
          `Learned from the monthly totals of homes on Carbon Wallet and the real weather at your city (${f.weather.split(";")[0]}). On months it hadn't seen, it was off by ${f.model.maeKg ?? "–"} kg on average, against ${f.model.baselineMaeKg ?? "–"} kg for "same as last month".`,
          `Carbon Wallet के घरों के मासिक आँकड़ों और आपके शहर के असली मौसम से सीखा गया। जिन महीनों को इसने नहीं देखा था, उन पर औसत गलती ${f.model.maeKg ?? "–"} किलो रही ("पिछले महीने जितना" मानने पर ${f.model.baselineMaeKg ?? "–"} किलो)।`,
        )}
      </p>
    </section>
  );
}
