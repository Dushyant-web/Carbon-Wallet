"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Seal } from "./Seal";
import { Ticker } from "./Ticker";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { LanguagePicker, TranslationNotice } from "@/components/i18n/LanguagePicker";
import type { TextSize } from "@/lib/uiPrefs";

/**
 * The public-portal header used by every signed-in app (households, shops, admin):
 *   1. tricolour hairline and a utility bar (skip link, text size, language), as GIGW asks of public sites;
 *   2. the masthead: our own seal, the name in Hindi and English, and the service it is;
 *   3. the "What's new" ticker.
 * It scrolls away; the menu and the context bar below stay.
 */
export function GovHeader({ service, serviceHi, home = "/dashboard" }: { service: string; serviceHi: string; home?: string }) {
  const { lang, size, setSize, t } = useUiPrefs();
  const sizes: [TextSize, string, string][] = [
    [0, "A", t("Normal text", "सामान्य अक्षर")],
    [1, "A+", t("Larger text", "बड़े अक्षर")],
    [2, "A++", t("Largest text", "सबसे बड़े अक्षर")],
  ];

  return (
    <div className="print:hidden">
      <div className="flex h-[3px]" aria-hidden>
        <span className="flex-1 bg-[#FF9933]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#138808]" />
      </div>

      {/* 1 · utility bar */}
      <div className="bg-gov-deep text-white">
        <div className="flex h-9 items-center justify-between gap-3 px-3 text-[12px] md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden truncate font-devanagari text-white/80 md:inline">नागरिक कार्बन सेवा</span>
            <span className="hidden text-white/40 md:inline">|</span>
            <span className="hidden truncate text-white/80 md:inline">Citizen Carbon Service</span>
            <a href="#main" className="shrink-0 underline-offset-2 hover:underline">
              {t("Skip to main content", "मुख्य सामग्री पर जाएँ")}
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center" role="group" aria-label={t("Text size", "अक्षर का आकार")}>
              {sizes.map(([s, label, name]) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  aria-label={name}
                  title={name}
                  className={`h-7 min-w-[30px] px-1.5 font-semibold ${size === s ? "bg-white text-gov-deep" : "text-white/85 hover:bg-white/10"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="h-4 w-px bg-white/30" aria-hidden />
            <LanguagePicker />
          </div>
        </div>
      </div>

      {/* 2 · masthead */}
      <div className="border-b-[3px] border-gov-saffron bg-white">
        <div className="flex items-center justify-between gap-4 px-3 py-2.5 md:px-6">
          <Link href={home} className="flex min-w-0 items-center gap-3">
            <Seal size={52} className="shrink-0" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-devanagari text-[19px] font-semibold text-gov-navy md:text-[21px]">कार्बन वॉलेट</span>
              <span className="font-heading text-[19px] font-semibold tracking-tight text-gov-navy md:text-[22px]">Carbon Wallet</span>
              <span className="truncate text-[11.5px] text-ink-muted">{lang === "hi" ? serviceHi : service}</span>
            </span>
          </Link>
          <div className="hidden items-center gap-5 md:flex">
            <div className="hidden text-right text-[12px] leading-tight text-ink-muted lg:block">
              <span className="block font-devanagari text-[13px] text-gov-navy">हर घर का कार्बन खाता</span>
              <span>{t("Carbon account for every home", "हर घर के लिए कार्बन खाता")}</span>
            </div>
            <Link
              href="/open-data"
              className="flex items-center gap-2 border border-gov-navy/30 px-3 py-2 text-[12.5px] font-semibold text-gov-navy hover:bg-gov-sky"
              title={t("Every month and every shop registration is sealed: check any record", "हर रिकॉर्ड सील है: कोई भी जाँच सकता है")}
            >
              <ShieldCheck className="h-4 w-4 text-gov-green" />
              {t("Open data & records", "खुला डेटा और रिकॉर्ड")}
            </Link>
          </div>
        </div>
      </div>

      {/* 3 · ticker */}
      <TranslationNotice />
      <Ticker />
    </div>
  );
}
