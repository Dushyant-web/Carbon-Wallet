"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { HEAT_COLOURS, heatStep } from "@/components/heatmap/HeatMapView";
import { monthWords } from "@/lib/plainWords";
import type { HeatMap } from "@/server/services/heatmap.service";

const HeatMapView = dynamic(() => import("@/components/heatmap/HeatMapView").then((m) => m.HeatMapView), {
  ssr: false,
  loading: () => <Skeleton className="h-[460px] w-full" />,
});

export default function HeatMapPage() {
  const { t, lang } = useUiPrefs();
  const { data, isLoading, error, refetch } = useQuery<HeatMap>({
    queryKey: ["heatmap"],
    queryFn: async () => {
      const res = await fetch("/api/heatmap");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't load the heat map.");
      return res.json();
    },
    staleTime: 10 * 60_000,
  });

  const areas = data?.areas ?? [];
  const values = areas.map((a) => a.kgPerPerson);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <span className="label-caps">{t("Heat map", "हीट मैप")}</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight">{t("Carbon, area by area", "इलाक़े के हिसाब से कार्बन")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {t(
            `Each shape is a mohalla. Darker means more carbon per person${data?.month ? ` in ${monthWords(data.month, lang)}` : ""}. Only areas with ${data?.minHomes ?? 20} or more homes are shown, never a single home.`,
            `हर आकार एक मोहल्ला है। गहरा रंग यानी प्रति व्यक्ति ज़्यादा कार्बन${data?.month ? ` (${monthWords(data.month, lang)})` : ""}। सिर्फ़ ${data?.minHomes ?? 20} या ज़्यादा घरों वाले इलाक़े दिखते हैं, कोई एक घर नहीं।`,
          )}
        </p>
      </header>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[460px] w-full" />
      ) : areas.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("No area has enough homes yet.", "अभी किसी इलाक़े में पर्याप्त घर नहीं हैं।")}</p>
      ) : (
        <>
          <HeatMapView
            areas={areas}
            labels={{
              aria: t("Map of carbon per person by mohalla", "मोहल्ले के हिसाब से प्रति व्यक्ति कार्बन का नक्शा"),
              recentre: t("Show all areas", "सारे इलाक़े दिखाएँ"),
              fullscreen: t("Full screen", "पूरी स्क्रीन"),
              low: t(`Low (${r1(min)} kg)`, `कम (${r1(min)} किलो)`),
              high: t(`High (${r1(max)} kg)`, `ज़्यादा (${r1(max)} किलो)`),
              perPerson: t("per person", "प्रति व्यक्ति"),
              homes: t("homes", "घर"),
            }}
          />

          <div className="flex items-center gap-2 text-[12px] text-ink-muted" aria-hidden>
            <span>{r1(min)} kg</span>
            {HEAT_COLOURS.map((c) => (
              <span key={c} className="h-3 w-8" style={{ backgroundColor: c }} />
            ))}
            <span>{r1(max)} kg</span>
            <span className="ml-2">· {t(`allowance ${data?.allowancePerPersonKg ?? 100} kg a person`, `सीमा ${data?.allowancePerPersonKg ?? 100} किलो प्रति व्यक्ति`)}</span>
          </div>

          <section className="border border-border bg-canvas-card">
            <h2 className="border-b border-border px-5 py-3 font-heading text-lg font-medium">{t("All areas, highest first", "सारे इलाक़े, सबसे ज़्यादा पहले")}</h2>
            <ul className="divide-y divide-border">
              {areas.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0" style={{ backgroundColor: HEAT_COLOURS[heatStep(a.kgPerPerson, min, max)] }} aria-hidden />
                    <span className="truncate">{a.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    <strong className="text-ink">{r1(a.kgPerPerson)} kg</strong> · {a.homes} {t("homes", "घर")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
