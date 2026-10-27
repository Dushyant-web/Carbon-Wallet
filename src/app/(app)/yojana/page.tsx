"use client";

import React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  BatteryCharging,
  Car,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Fingerprint,
  Flame,
  Landmark,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sun,
  Thermometer,
  Fan,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";

type Scheme = {
  slug: string;
  category: string;
  name: string;
  nameHi: string;
  summary: string;
  summaryHi: string;
  benefit: string;
  benefitHi: string;
  whoQualifies: string;
  steps: string[];
  documents: string[];
  link: string;
  helpline: string | null;
  validUntil: string | null;
  lastChecked: string;
  sourceUrl: string;
  status: string;
  reason?: string;
  reasonHi?: string;
  estimateInr?: number;
};
type Data = { state: string; ownsHome: boolean | null; forYou: Scheme[]; all: Scheme[]; help: { slug: string; status: string; shop: string | null; at: string }[] };

const ICONS: Record<string, LucideIcon> = { SOLAR: Sun, EV: BatteryCharging, SCRAPPAGE: Car, AC: Snowflake, EFFICIENT: Fan, LPG: Flame };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function YojanaPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { can } = usePermissions();
  const { lang, t } = useUiPrefs();
  const qc = useQueryClient();
  const key = ["household", activeHouseholdId, "schemes"];
  const { data, isLoading, error } = useQuery<Data>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/schemes`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("schemes unavailable");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });
  const isOwner = can("household:update");

  const applied = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/households/${activeHouseholdId}/schemes/${slug}`, { method: "POST", headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save");
    },
    onSuccess: () => {
      toast.success(t("Marked as applied. We'll remind you to check its status.", "आवेदन दर्ज हुआ। हम स्थिति देखने की याद दिलाएँगे।"));
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ownership = useMutation({
    mutationFn: async (ownsHome: boolean) => {
      const res = await fetch(`/api/households/${activeHouseholdId}/home`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-demo-role": demoRole },
        body: JSON.stringify({ ownsHome }),
      });
      if (!res.ok) throw new Error("Couldn't save");
    },
    onSuccess: () => {
      toast.success(t("Thanks. Your scheme list is updated.", "धन्यवाद। आपकी योजना सूची बदल गई।"));
      qc.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error(t("Couldn't save. Try again.", "सेव नहीं हुआ।")),
  });

  // "no data and no error yet" is loading too: that is what the server renders, so the first paint matches
  if (isLoading || (!data && !error)) return <div className="flex flex-col gap-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (error || !data) return <ErrorState title={t("Couldn't load schemes", "योजनाएँ नहीं खुलीं")} message={t("Please try again in a moment.", "थोड़ी देर में फिर कोशिश करें।")} />;

  const appliedSlugs = new Set(data.help.filter((h) => h.status === "APPLIED").map((h) => h.slug));
  const pick = (s: Scheme, en: keyof Scheme, hi: keyof Scheme) => String((lang === "hi" ? s[hi] : s[en]) ?? "");
  const totalEstimate = data.forYou.reduce((a, s) => a + (s.estimateInr ?? 0), 0);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <span className="label-caps">{t("Govt schemes", "सरकारी योजना")}</span>
        <h1 className="mt-1.5 font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">
          {t("Government help you can get", "सरकारी मदद जो आपको मिल सकती है")}
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
          {t(
            "Many families never hear about these. We check what your home owns and your bills, and show the schemes that fit, with the steps to apply.",
            "बहुत से परिवार इनके बारे में नहीं जानते। हम आपके घर का सामान और बिल देखकर सही योजनाएँ और आवेदन के तरीके बताते हैं।",
          )}
        </p>
      </header>

      <div className="flex items-start gap-3 border-l-4 border-warning bg-warning-subtle px-4 py-3 text-[14px] text-warning-text">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <strong>{t("We never ask for money.", "हम कभी पैसे नहीं माँगते।")}</strong>{" "}
          {t(
            "Apply only on the official website or at the dealer. Never pay anyone who promises to “get” you a subsidy.",
            "केवल सरकारी वेबसाइट या डीलर पर आवेदन करें। सब्सिडी “दिलाने” के नाम पर किसी को पैसे न दें।",
          )}
        </p>
      </div>

      {isOwner && data.ownsHome === null && (
        <section className="flex flex-col gap-3 border border-ink bg-canvas-card p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[16px] font-semibold">{t("Is this house yours?", "क्या यह घर आपका है?")}</p>
            <p className="text-[14px] text-ink-muted">{t("Some schemes, like rooftop solar, are only for owners.", "कुछ योजनाएँ, जैसे छत पर सोलर, सिर्फ़ मालिकों के लिए हैं।")}</p>
          </div>
          <div className="flex gap-2">
            <button disabled={ownership.isPending} onClick={() => ownership.mutate(true)} className="h-11 rounded-md bg-ink px-5 text-sm font-semibold text-canvas-card">
              {t("Yes, we own it", "हाँ, अपना है")}
            </button>
            <button disabled={ownership.isPending} onClick={() => ownership.mutate(false)} className="h-11 rounded-md border border-border bg-canvas-card px-5 text-sm font-semibold hover:border-ink">
              {t("No, we rent", "नहीं, किराए पर")}
            </button>
          </div>
        </section>
      )}

      {/* For your home */}
      <section aria-labelledby="for-you">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="for-you" className="font-heading text-2xl font-medium">
            {t("For your home", "आपके घर के लिए")} <span className="text-ink-muted">({data.forYou.length})</span>
          </h2>
          {totalEstimate > 0 && (
            <p className="text-[14px] text-ink-muted">
              {t("Worth up to", "कुल लाभ")} <strong className="text-lg text-success-text">₹{totalEstimate.toLocaleString("en-IN")}</strong>
            </p>
          )}
        </div>
        {data.forYou.length === 0 ? (
          <p className="mt-3 border border-border bg-canvas-card p-5 text-[15px] text-ink-muted">
            {t(
              "Nothing matches your home right now. When a shop registers a new item or your bills change, we look again and notify you.",
              "अभी कोई योजना मेल नहीं खाती। नया सामान या बिल आने पर हम फिर देखेंगे और बताएँगे।",
            )}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
            {data.forYou.map((s) => {
              const Icon = ICONS[s.category] ?? Landmark;
              const done = appliedSlugs.has(s.slug);
              const shopHelp = data.help.find((h) => h.slug === s.slug && h.shop);
              return (
                <article key={s.slug} className="flex flex-col border border-border bg-canvas-card">
                  <div className="flex items-start gap-4 border-b border-border p-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-success-subtle text-success-text">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[17px] font-semibold leading-snug">{pick(s, "name", "nameHi")}</h3>
                      <p className="mt-0.5 text-[14px] text-ink-muted">{pick(s, "summary", "summaryHi")}</p>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <p className="border-l-4 border-success bg-success-subtle px-3 py-2 text-[15px] font-semibold text-success-text">{pick(s, "benefit", "benefitHi")}</p>
                    <p className="text-[15px] leading-relaxed">
                      <span className="font-semibold">{t("Why you: ", "आप क्यों: ")}</span>
                      {pick(s, "reason", "reasonHi")}
                    </p>
                    <div>
                      <p className="label-caps">{t("How to get it", "कैसे लें")}</p>
                      <ol className="mt-2 flex flex-col gap-1.5 text-[14px]">
                        {s.steps.map((step, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-canvas-card">{i + 1}</span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    {s.documents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="label-caps w-full">{t("Keep ready", "तैयार रखें")}</span>
                        {s.documents.map((d) => (
                          <span key={d} className="rounded-full border border-border bg-canvas-subtle px-2.5 py-0.5 text-[12px]">{d}</span>
                        ))}
                      </div>
                    )}
                    {s.status === "CHECK" && (
                      <p className="text-[13px] text-warning-text">{t("Terms may have changed: confirm on the official site.", "शर्तें बदल सकती हैं: सरकारी साइट पर जाँचें।")}</p>
                    )}
                    {shopHelp && (
                      <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                        <BadgeCheck className="h-4 w-4 text-success" /> {t(`${shopHelp.shop} told you about this`, `${shopHelp.shop} ने इसके बारे में बताया`)}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                      <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-canvas-card hover:bg-black">
                        {t("Official website", "सरकारी वेबसाइट")} <ExternalLink className="h-4 w-4" />
                      </a>
                      {s.helpline && (
                        <a href={`tel:${s.helpline}`} className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:border-ink">
                          <Phone className="h-4 w-4" /> {s.helpline}
                        </a>
                      )}
                      {done ? (
                        <span className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-semibold text-success-text">
                          <CheckCircle2 className="h-5 w-5" /> {t("You applied", "आवेदन किया")}
                        </span>
                      ) : (
                        isOwner && (
                          <button onClick={() => applied.mutate(s.slug)} disabled={applied.isPending} className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm hover:border-ink">
                            {t("We applied", "हमने आवेदन किया")}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <p className="border-t border-border px-5 py-2 font-mono text-[10.5px] text-ink-muted">
                    {t("Checked", "जाँचा")} {day(s.lastChecked)}
                    {s.validUntil ? ` · ${t("till", "तक")} ${day(s.validUntil)}` : ""} ·{" "}
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {t("source", "स्रोत")}
                    </a>
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Free services */}
      <section aria-labelledby="free">
        <h2 id="free" className="font-heading text-2xl font-medium">{t("Free help from Carbon Wallet", "Carbon Wallet की मुफ़्त सेवाएँ")}</h2>
        <p className="mt-1 text-[14px] text-ink-muted">{t("No charge, ever. These come with your card.", "कोई शुल्क नहीं। ये आपके कार्ड के साथ हैं।")}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Free href="/bills" Icon={FileSearch} title={t("Bill check", "बिल जाँच")} sub={t("We read every bill and flag a sudden jump or a wrong reading.", "हर बिल पढ़कर अचानक बढ़ोतरी या ग़लत रीडिंग बताते हैं।")} />
          <Free href="/calibration" Icon={Thermometer} title={t("AC health check", "एसी जाँच")} sub={t("Is your AC using more power than its label says? Time for a service?", "क्या एसी लेबल से ज़्यादा बिजली ले रहा है?")} />
          <Free href="/yojana" Icon={Landmark} title={t("Scheme finder", "योजना खोज")} sub={t("This page: we look again whenever something changes.", "यह पेज: कुछ बदलते ही फिर देखते हैं।")} />
          <Free href="/carbon-id" Icon={Fingerprint} title={t("Carbon Card", "कार्बन कार्ड")} sub={t("Show it at shops to register new items and hear about benefits.", "दुकान पर दिखाएँ, सामान जुड़ेगा और लाभ पता चलेंगे।")} />
          <Free href="/proof" Icon={ShieldCheck} title={t("Green certificate", "ग्रीन प्रमाणपत्र")} sub={t("Sealed records a bank can check for a green loan.", "बैंक ग्रीन लोन के लिए जाँच सके, ऐसा पक्का रिकॉर्ड।")} />
        </div>
      </section>

      {/* Everything in the state */}
      <section aria-labelledby="all">
        <h2 id="all" className="font-heading text-2xl font-medium">{t("All schemes", "सभी योजनाएँ")}</h2>
        <div className="mt-3 divide-y divide-border border border-border bg-canvas-card">
          {data.all.map((s) => {
            const Icon = ICONS[s.category] ?? Landmark;
            return (
              <details key={s.slug} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-canvas-subtle">
                  <Icon className="h-5 w-5 shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{pick(s, "name", "nameHi")}</span>
                    <span className="block truncate text-[13px] text-ink-muted">{pick(s, "benefit", "benefitHi")}</span>
                  </span>
                  <span className="text-ink-muted transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="flex flex-col gap-2 px-4 pb-4 pl-12 text-[14px]">
                  <p>{pick(s, "summary", "summaryHi")}</p>
                  <p>
                    <span className="font-semibold">{t("Who can get it: ", "कौन ले सकता है: ")}</span>
                    {s.whoQualifies}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                      {t("Official website", "सरकारी वेबसाइट")} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {s.helpline && <a href={`tel:${s.helpline}`} className="underline underline-offset-2">{t("Helpline", "हेल्पलाइन")} {s.helpline}</a>}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-ink-muted">
          {t("Shops on Carbon Wallet also tell you about these at the counter when they scan your card.", "Carbon Wallet वाली दुकानें आपका कार्ड स्कैन करते समय भी ये बताती हैं।")}{" "}
          <Link href="/assets" className="underline">{t("Your card", "आपका कार्ड")}</Link>
        </p>
      </section>
    </div>
  );
}

function Free({ href, Icon, title, sub }: { href: string; Icon: LucideIcon; title: string; sub: string }) {
  return (
    <Link href={href} className="flex flex-col gap-2 border border-border bg-canvas-card p-4 hover:border-ink">
      <Icon className="h-6 w-6 text-secondary" />
      <span className="text-[15px] font-semibold">{title}</span>
      <span className="text-[13px] leading-snug text-ink-muted">{sub}</span>
    </Link>
  );
}
