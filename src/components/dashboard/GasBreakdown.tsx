"use client";

import React from "react";
import Link from "next/link";
import { GAS_INFO, GASES, type Gas } from "@/lib/ghg";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

const COLOR: Record<Gas, string> = { CO2: "#3B4A63", CH4: "#B7862B", N2O: "#8E4A6B", HFC: "#2C7DA0", MIXED: "#7A8B5C" };

/** The month's carbon split by gas: CO₂, methane, nitrous oxide, AC refrigerant gases, and food/travel as CO₂e. */
export function GasBreakdown({ gases, monthName }: { gases: Partial<Record<Gas, number>>; monthName: string }) {
  const { t, lang } = useUiPrefs();
  const rows = GASES.map((g) => [g, gases[g] ?? 0] as const).filter(([, kg]) => kg > 0.05);
  const total = rows.reduce((s, [, kg]) => s + kg, 0);
  if (!total) return null;
  return (
    <section className="border border-border bg-canvas-card p-5 md:p-6" aria-labelledby="gas-h">
      <h2 id="gas-h" className="font-heading text-xl font-medium">
        {t("Which gases", "कौन सी गैसें")}
      </h2>
      <p className="mt-1 text-[14px] text-ink-muted">
        {t(
          `Not only carbon dioxide: every greenhouse gas from your home in ${monthName}, counted as CO₂e (what it would take in CO₂ to warm the planet as much over 100 years).`,
          `सिर्फ़ कार्बन डाइऑक्साइड नहीं: ${monthName} में आपके घर की हर ग्रीनहाउस गैस, CO₂e में गिनी गई (100 साल में उतनी गर्मी के लिए कितनी CO₂ लगती)।`,
        )}
      </p>
      <div className="mt-4 flex h-4 w-full overflow-hidden bg-canvas-subtle" role="img" aria-label={rows.map(([g, kg]) => `${GAS_INFO[g].formula} ${Math.round((kg / total) * 100)}%`).join(", ")}>
        {rows.map(([g, kg]) => (
          <div key={g} style={{ width: `${(kg / total) * 100}%`, backgroundColor: COLOR[g] }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(([g, kg]) => {
          const info = GAS_INFO[g];
          const pct = (kg / total) * 100;
          return (
            <li key={g} className="flex gap-3">
              <span className="mt-1 h-3 w-3 shrink-0" style={{ backgroundColor: COLOR[g] }} aria-hidden />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                  <strong>{info.formula}</strong>
                  <span className="text-ink-muted">{lang === "hi" ? info.hi : info.en}</span>
                  <span className="ml-auto tabular-nums">
                    <strong>{pct < 1 ? pct.toFixed(1) : Math.round(pct)}%</strong> · {kg < 10 ? kg.toFixed(1) : Math.round(kg)} kg
                  </span>
                </span>
                <span className="block text-[12.5px] text-ink-muted">
                  {lang === "hi" ? info.fromHi : info.from}
                  {g !== "MIXED" && <> · {t("warming factor", "गर्मी गुणांक")} ×{info.gwp}</>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] text-ink-muted">
        {t("Warming factors: IPCC Sixth Assessment Report (AR6), 100 years. ", "गर्मी गुणांक: IPCC AR6, 100 साल। ")}
        <Link href="/how-we-calculate" className="underline underline-offset-2">
          {t("How we count", "हम कैसे गिनते हैं")}
        </Link>
      </p>
    </section>
  );
}
