"use client";

import { localeFor, type Lang } from "@/lib/languages";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  Flame,
  Landmark,
  Leaf,
  Lightbulb,
  MapPin,
  Store,
  Sun,
  TrendingDown,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { LocationSetup } from "@/components/mohalla/LocationSetup";
import type { MohallaMapData } from "@/components/mohalla/MohallaMap";
import { monthWords } from "@/lib/plainWords";
import type { AreaLevel, FeedItem, MohallaFacts } from "@/server/services/mohalla.service";
import type { Weather } from "@/server/services/weather.service";
import type { OfficialFigure } from "@/lib/officialData";

const MohallaMap = dynamic(() => import("@/components/mohalla/MohallaMap").then((m) => m.MohallaMap), {
  ssr: false,
  loading: () => <div className="h-[380px] w-full animate-pulse bg-canvas-subtle" />,
});

type View = {
  minHomes: number;
  month?: string | null;
  location: { source: string; pincode: string | null; locality: string | null; district: string | null; updatedAt: string } | null;
  mohalla?: { name: string; homes: number } | null;
  levels?: AreaLevel[];
  weather?: Weather | null;
  heat?: { maxC: number; level: "NONE" | "HOT" | "SEVERE"; extraKg: number; extraHours: number } | null;
  feed?: FeedItem[];
  facts?: MohallaFacts | null;
  demoHomes?: number;
  map?: MohallaMapData;
  official?: (OfficialFigure & { monthlyKg: number })[];
  place?: string;
};

function sky(code: number): [LucideIcon, string, string] {
  if (code >= 95) return [CloudLightning, "Thunderstorm", "आँधी-तूफ़ान"];
  if (code >= 80 || (code >= 61 && code <= 67) || (code >= 51 && code <= 57)) return [CloudRain, "Rain", "बारिश"];
  if (code === 45 || code === 48) return [CloudFog, "Fog / haze", "कोहरा / धुंध"];
  if (code >= 1 && code <= 3) return [CloudSun, "Partly cloudy", "थोड़े बादल"];
  return [Sun, "Clear", "साफ़"];
}
const AQI_STYLE: Record<string, [string, string]> = {
  Good: ["bg-[#2E7D32] text-white", "अच्छी"],
  Satisfactory: ["bg-[#8BC34A] text-ink", "संतोषजनक"],
  Moderate: ["bg-[#FBC02D] text-ink", "मध्यम"],
  Poor: ["bg-[#F57C00] text-white", "ख़राब"],
  "Very poor": ["bg-[#D32F2F] text-white", "बहुत ख़राब"],
  Severe: ["bg-[#7B1F1F] text-white", "गंभीर"],
};
const FEED_ICON: Record<FeedItem["kind"], LucideIcon> = {
  HEAT: Flame,
  AIR: Wind,
  TREND: TrendingDown,
  COMPARE: Users,
  TIP: Lightbulb,
  RAIN: CloudRain,
  GREEN: Leaf,
  SHOPS: Store,
  SCHEME: Landmark,
};
const KIND_LABEL: Record<FeedItem["kind"], [string, string]> = {
  HEAT: ["Heat", "गर्मी"],
  AIR: ["Air", "हवा"],
  TREND: ["Trend", "रुझान"],
  COMPARE: ["Your home", "आपका घर"],
  TIP: ["Tip", "सुझाव"],
  RAIN: ["Rain", "बारिश"],
  GREEN: ["Green homes", "हरे घर"],
  SHOPS: ["Shops", "दुकानें"],
  SCHEME: ["Schemes", "योजनाएँ"],
};
const dayName = (iso: string, lang: Lang) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString(localeFor(lang), { weekday: "short" });

export default function MohallaPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { can } = usePermissions();
  const { lang, t } = useUiPrefs();
  const qc = useQueryClient();
  const [changing, setChanging] = useState(false);
  const key = ["household", activeHouseholdId, "mohalla"];
  const { data, isLoading, error } = useQuery<View>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/mohalla`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("mohalla unavailable");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });
  const isOwner = can("household:update");
  const saved = () => {
    setChanging(false);
    qc.invalidateQueries({ queryKey: key });
  };

  // "no data and no error yet" is loading too: that is what the server renders, so the first paint matches
  if (isLoading || (!data && !error)) return <div className="flex flex-col gap-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (error || !data) return <ErrorState title={t("Couldn't load your mohalla", "मोहल्ला नहीं खुला")} message={t("Please try again in a moment.", "थोड़ी देर में फिर कोशिश करें।")} />;

  if (!data.location || changing) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <span className="label-caps">{t("My mohalla", "मेरा मोहल्ला")}</span>
          <h1 className="mt-1.5 font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">{t("Set up your mohalla", "अपना मोहल्ला चुनें")}</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
            {t(
              "About 40 homes near you form a mohalla. Once your place is set, you get your mohalla's own daily news: weather, air, how the area is doing, and what it means for your home.",
              "आपके पास के लगभग 40 घर एक मोहल्ला बनाते हैं। जगह चुनने के बाद आपको मोहल्ले का रोज़ का समाचार मिलेगा: मौसम, हवा, इलाके का हाल और आपके घर पर असर।",
            )}
          </p>
        </header>
        {isOwner ? (
          <LocationSetup householdId={activeHouseholdId} demoRole={demoRole} onSaved={saved} onCancel={data.location ? () => setChanging(false) : undefined} />
        ) : (
          <p className="border border-border bg-canvas-card p-5 text-[15px]">
            {t("The home's owner hasn't set where the home is yet. Ask them to open My mohalla.", "घर के मालिक ने अभी जगह नहीं बताई है। उन्हें मोहल्ला पेज खोलने को कहें।")}
          </p>
        )}
      </div>
    );
  }

  const w = data.weather;
  const today = w?.days[0];
  const [NowIcon, nowEn, nowHi] = sky(w?.now?.code ?? today?.code ?? 0);
  const levels = data.levels ?? [];
  const feed = data.feed ?? [];
  const [lead, ...briefs] = feed;
  const now = new Date();
  const dateline = now.toLocaleDateString(localeFor(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const issue = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const place = data.place || data.mohalla?.name || t("Your mohalla", "आपका मोहल्ला");
  const official = data.official ?? [];
  const tableMax = Math.max(1, ...levels.map((l) => l.kgPerPerson ?? 0), ...official.map((o) => o.monthlyKg));
  const leadText = lead ? (lang === "hi" ? lead.hi : lead.en) : "";

  return (
    <div className="flex flex-col gap-6">
      <article className="border border-ink/25 bg-[#FCFAF4] px-4 py-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] md:px-8 md:py-7">
        {/* Masthead */}
        <header className="border-b-[5px] border-double border-ink pb-3 text-center">
          <div className="flex items-center justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
            <span>{t(`Issue ${issue}`, `अंक ${issue}`)}</span>
            <span className="hidden sm:inline">{t("Free · for every home", "मुफ़्त · हर घर के लिए")}</span>
            <span>{t("Daily", "दैनिक")}</span>
          </div>
          <h1 className="mt-1 font-devanagari text-[44px] font-semibold leading-none text-gov-navy md:text-[64px]">मोहल्ला समाचार</h1>
          <p className="mt-1 font-heading text-[15px] uppercase tracking-[0.35em] text-ink md:text-[17px]">Mohalla Samachar</p>
        </header>
        <div className="flex flex-col items-center justify-between gap-1 border-b border-ink py-2 text-[13px] md:flex-row">
          <span className="flex items-center gap-1.5 font-semibold">
            <MapPin className="h-4 w-4 text-gov-saffron" /> {place}
            {data.location.pincode ? <span className="font-normal text-ink-muted"> · {data.location.pincode}</span> : null}
          </span>
          <span className="text-ink-muted">{dateline}</span>
          <span className="flex items-center gap-3 text-ink-muted">
            {data.mohalla && (
              <span>
                <Users className="mr-1 inline h-3.5 w-3.5" />
                {data.mohalla.homes} {t("homes", "घर")}
              </span>
            )}
            {w?.now && (
              <span>
                <NowIcon className="mr-1 inline h-3.5 w-3.5" />
                {Math.round(w.now.tempC)}°C
              </span>
            )}
            {w?.air?.aqi != null && <span>AQI {w.air.aqi}</span>}
            {isOwner && (
              <button onClick={() => setChanging(true)} className="underline underline-offset-2 hover:text-ink">
                {t("Change place", "जगह बदलें")}
              </button>
            )}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Lead story + map */}
          <section className="lg:col-span-8 lg:border-r lg:border-ink/20 lg:pr-6">
            {lead ? (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gov-saffron">{t("Top story", "मुख्य समाचार")}</p>
                <h2 className="mt-1 font-heading text-[30px] font-semibold leading-[1.1] tracking-tight md:text-[40px]">{lang === "hi" ? lead.title.hi : lead.title.en}</h2>
                <p className="mt-3 text-[16px] leading-relaxed">
                  <span className="float-left mr-2 mt-1 font-heading text-[46px] font-semibold leading-[0.8] text-gov-navy">{leadText.charAt(0)}</span>
                  {leadText.slice(1)}
                </p>
                <p className="mt-2 clear-both font-mono text-[10.5px] text-ink-muted">
                  {t("Source", "स्रोत")}: {lead.source}
                </p>
              </>
            ) : (
              <h2 className="font-heading text-3xl">{t("A quiet day in the mohalla", "मोहल्ले में शांत दिन")}</h2>
            )}

            {data.map && (
              <figure className="mt-5">
                <MohallaMap
                  data={data.map}
                  labels={{
                    home: t("Your home (approx.)", "आपका घर (लगभग)"),
                    mohalla: place,
                    weather: t("Weather is read here", "मौसम यहाँ का"),
                    aria: t(`Map of ${place}`, `${place} का नक्शा`),
                    recentre: t("Back to the mohalla", "मोहल्ले पर वापस"),
                    fullscreen: t("Full screen", "पूरी स्क्रीन"),
                  }}
                />
                <figcaption className="mt-1.5 text-[12px] text-ink-muted">
                  {t(
                    `${place}: the dashed outline is drawn from groups of homes, never single houses; the orange hexagon is your home's area (about 120 m across). Map © OpenStreetMap contributors.`,
                    `${place}: बिंदुदार रेखा घरों के समूह से बनी है, किसी एक घर से नहीं; नारंगी षट्भुज आपके घर का इलाका है (लगभग 120 मीटर)। नक्शा © OpenStreetMap।`,
                  )}
                </figcaption>
              </figure>
            )}
          </section>

          {/* Weather and air columns */}
          <aside className="flex flex-col gap-5 lg:col-span-4">
            <section className="border border-ink/25 p-4">
              <h3 className="border-b border-ink pb-1 font-heading text-[18px] font-semibold">{t("Weather", "मौसम")}</h3>
              {w?.now ? (
                <div className="mt-3 flex items-center gap-3">
                  <NowIcon className="h-12 w-12 text-gov-saffron" />
                  <div>
                    <p className="font-heading text-4xl font-semibold tabular-nums">{Math.round(w.now.tempC)}°C</p>
                    <p className="text-[13px] text-ink-muted">
                      {lang === "hi" ? nowHi : nowEn} · {t("feels", "महसूस")} {Math.round(w.now.feelsC)}° · <Droplets className="inline h-3 w-3" /> {w.now.humidity}%
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-ink-muted">{t("Not available right now.", "अभी उपलब्ध नहीं।")}</p>
              )}
              {w && w.days.length > 1 && (
                <table className="mt-3 w-full text-[13px]">
                  <caption className="sr-only">{t("Five-day forecast", "पाँच दिन का पूर्वानुमान")}</caption>
                  <tbody>
                    {w.days.slice(0, 5).map((d, i) => {
                      const [I] = sky(d.code);
                      return (
                        <tr key={d.date} className={`border-t border-ink/10 ${d.maxC >= 40 ? "bg-critical-subtle" : ""}`}>
                          <td className="py-1.5 font-semibold">{i === 0 ? t("Today", "आज") : i === 1 ? t("Tomorrow", "कल") : dayName(d.date, lang)}</td>
                          <td className="py-1.5">
                            <I className="h-4 w-4" />
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            <strong>{Math.round(d.maxC)}°</strong> / {Math.round(d.minC)}°
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-ink-muted">{d.rainPct ?? 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {data.heat && (
                <p className={`mt-3 border-t border-ink/20 pt-2 text-[13px] ${data.heat.level !== "NONE" ? "font-semibold text-critical-text" : ""}`}>
                  {data.heat.level !== "NONE"
                    ? t(`Tomorrow ${data.heat.maxC}°C: about +${data.heat.extraKg} kg CO₂e from your ACs.`, `कल ${data.heat.maxC}°C: एसी से लगभग +${data.heat.extraKg} किलो CO₂e।`)
                    : t(`Tomorrow ${data.heat.maxC}°C: no extra AC load expected.`, `कल ${data.heat.maxC}°C: एसी पर अतिरिक्त भार नहीं।`)}
                </p>
              )}
            </section>

            <section className="border border-ink/25 p-4">
              <h3 className="border-b border-ink pb-1 font-heading text-[18px] font-semibold">{t("Air", "हवा")}</h3>
              {w?.air?.aqi != null && w.air.band ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className={`px-3 py-2 font-heading text-3xl font-semibold tabular-nums ${AQI_STYLE[w.air.band][0]}`}>{w.air.aqi}</span>
                  <div>
                    <p className="text-[15px] font-semibold">{lang === "hi" ? AQI_STYLE[w.air.band][1] : w.air.band}</p>
                    <p className="text-[12px] text-ink-muted">
                      {t("Indian AQI, approx.", "भारतीय AQI, लगभग")} · PM2.5 {Math.round(w.air.pm25 ?? 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-ink-muted">{t("Not available right now.", "अभी उपलब्ध नहीं।")}</p>
              )}
            </section>

            {data.facts && data.facts.homesWithData > 0 && (
              <section className="border border-ink/25 p-4">
                <h3 className="border-b border-ink pb-1 font-heading text-[18px] font-semibold">{t("Mohalla at a glance", "मोहल्ला एक नज़र में")}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <dt className="text-ink-muted">{t("Green homes", "हरे घर")}</dt>
                    <dd className="font-heading text-2xl font-semibold tabular-nums">
                      {data.facts.green}/{data.facts.homesWithData}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("Efficient buys", "कुशल ख़रीद")}</dt>
                    <dd className="font-heading text-2xl font-semibold tabular-nums">
                      {data.facts.shopItems ? Math.round((data.facts.efficientItems / data.facts.shopItems) * 100) : 0}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("Items from shops", "दुकानों से सामान")}</dt>
                    <dd className="font-heading text-2xl font-semibold tabular-nums">{data.facts.shopItems}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("Applied for schemes", "योजना आवेदन")}</dt>
                    <dd className="font-heading text-2xl font-semibold tabular-nums">{data.facts.schemeApplied}</dd>
                  </div>
                </dl>
              </section>
            )}
          </aside>
        </div>

        {/* The numbers, ours and the official ones */}
        <section className="mt-7 border-t-[3px] border-ink pt-3">
          <h3 className="font-heading text-[24px] font-semibold">{t("The numbers", "आँकड़े")}</h3>
          <p className="text-[13px] text-ink-muted">
            {t("Kilograms of CO₂e per person in a month", "प्रति व्यक्ति, एक महीने में किलो CO₂e")}
            {data.month ? ` · ${monthWords(data.month, lang)}` : ""}. {t("Shorter is better.", "छोटा बेहतर है।")}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{t("Carbon Wallet homes: what homes burn directly", "Carbon Wallet घर: घर में सीधा इस्तेमाल")}</p>
              <ul className="mt-2 flex flex-col gap-2.5">
                {levels.map((l) => (
                  <li key={l.level}>
                    <div className="flex items-baseline justify-between gap-2 text-[14px]">
                      <span className={l.level === "HOME" ? "font-semibold" : ""}>{lang === "hi" ? l.nameHi : l.name}</span>
                      <span className="tabular-nums">
                        {l.kgPerPerson !== null ? <strong>{l.kgPerPerson} kg</strong> : <span className="text-[12px] text-ink-muted">{t(`shown from ${data.minHomes} homes`, `${data.minHomes} घरों से दिखेगा`)}</span>}
                        {l.level !== "HOME" && l.homes ? (
                          <span className="text-[12px] text-ink-muted">
                            {" "}
                            · {l.homes} {t("homes", "घर")}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1 h-3 bg-ink/[0.06]">
                      {l.kgPerPerson !== null && <div className={l.level === "HOME" ? "h-full bg-gov-saffron" : "h-full bg-gov-navy"} style={{ width: `${Math.max(2, (l.kgPerPerson / tableMax) * 100)}%` }} />}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{t("Official and published figures: whole economy", "आधिकारिक और प्रकाशित आँकड़े: पूरी अर्थव्यवस्था")}</p>
              <ul className="mt-2 flex flex-col gap-2.5">
                {official.map((o) => (
                  <li key={o.key}>
                    <div className="flex items-baseline justify-between gap-2 text-[14px]">
                      <span>
                        {lang === "hi" ? o.nameHi : o.name} <span className="text-[12px] text-ink-muted">({o.year})</span>
                      </span>
                      <span className="tabular-nums">
                        <strong>{o.monthlyKg} kg</strong>{" "}
                        <span className="text-[12px] text-ink-muted">
                          · {o.perCapitaT} t/{t("year", "वर्ष")}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-3 bg-ink/[0.06]">
                      <div className="h-full bg-gov-green/70" style={{ width: `${Math.max(2, (o.monthlyKg / tableMax) * 100)}%` }} />
                    </div>
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-muted underline">
                      {o.scope} · {o.source} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            {t(
              "Why the two sides differ: official figures count everything in the economy, from power plants and factories to farms, divided by every resident. Carbon Wallet counts only what a home burns itself: its electricity, cooking gas and vehicles.",
              "दोनों में फ़र्क़ क्यों: आधिकारिक आँकड़े बिजलीघर, कारख़ाने, खेती सब कुछ गिनते हैं और हर निवासी में बाँटते हैं। Carbon Wallet सिर्फ़ वह गिनता है जो घर ख़ुद इस्तेमाल करता है: बिजली, खाना पकाने की गैस और गाड़ियाँ।",
            )}{" "}
            <Link href="/open-data" className="underline">
              {t("All sources", "सभी स्रोत")}
            </Link>
          </p>
        </section>

        {/* More news */}
        {briefs.length > 0 && (
          <section className="mt-7 border-t-[3px] border-ink pt-3">
            <h3 className="font-heading text-[24px] font-semibold">{t("More news", "और ख़बरें")}</h3>
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              {briefs.map((f, i) => {
                const I = FEED_ICON[f.kind] ?? Leaf;
                return (
                  <article key={i} className="border-t border-ink/25 pt-3">
                    <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-gov-blue">
                      <I className="h-3.5 w-3.5" /> {KIND_LABEL[f.kind][lang === "hi" ? 1 : 0]}
                    </p>
                    <h4 className="mt-1 font-heading text-[19px] font-semibold leading-snug">{lang === "hi" ? f.title.hi : f.title.en}</h4>
                    <p className="mt-1 text-[14px] leading-relaxed">{lang === "hi" ? f.hi : f.en}</p>
                    <p className="mt-1 font-mono text-[10px] text-ink-muted">{f.source}</p>
                    {f.kind === "SCHEME" && (
                      <Link href="/yojana" className="mt-1 inline-block text-[13px] font-semibold text-gov-blue underline">
                        {t("Schemes for your home →", "आपके लिए योजनाएँ →")}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* What's true */}
        <section className="mt-7 border-y border-ink py-3 text-[13px] leading-relaxed">
          <strong className="font-heading text-[15px]">{t("What's true and what isn't. ", "सच क्या है। ")}</strong>
          {t(
            "Your mohalla's carbon doesn't change today's weather. Heat makes ACs run longer, so it raises carbon; AC exhaust can warm crowded streets at night by about a degree; and everyone's CO₂ together makes heatwaves more common over the years.",
            "आपके मोहल्ले का कार्बन आज का मौसम नहीं बदलता। गर्मी से एसी ज़्यादा चलते हैं, इसलिए कार्बन बढ़ता है; एसी की गर्म हवा भीड़ वाली गलियों को रात में लगभग एक डिग्री गर्म कर सकती है; और सबका CO₂ मिलकर सालों में लू बढ़ाता है।",
          )}
        </section>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-muted">
          {t(`Totals are shown only from ${data.minHomes} homes, so no single home can be picked out.`, `कुल आँकड़े सिर्फ़ ${data.minHomes} घरों से दिखते हैं, ताकि किसी एक घर की पहचान न हो।`)}
          {(data.demoHomes ?? 0) > 0 ? ` ${t("Neighbouring homes here are example households for the hackathon demo.", "यहाँ के पड़ोसी घर हैकथॉन डेमो के उदाहरण घर हैं।")}` : ""}
          {w ? ` ${w.source} · ${t("updated", "अपडेट")} ${new Date(w.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.` : ""}
        </p>
      </article>
    </div>
  );
}
