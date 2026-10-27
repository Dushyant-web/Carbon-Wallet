"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { Seal } from "@/components/gov/Seal";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import type { PortalStats, Update } from "@/server/services/portal.service";

/** Public-portal footer: services, policies, helplines, live counts, last update, and what this site is (and isn't). */
export function AppFooter() {
  const { t } = useUiPrefs();
  const { data } = useQuery<{ updates: Update[]; stats: PortalStats }>({
    queryKey: ["portal", "updates"],
    queryFn: async () => (await fetch("/api/public/updates")).json(),
    staleTime: 10 * 60_000,
  });
  const s = data?.stats;
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: t("Services", "सेवाएँ"),
      links: [
        ["/bills/new", t("Add electricity bill", "बिजली बिल डालें")],
        ["/mohalla", t("Mohalla news", "मोहल्ला समाचार")],
        ["/yojana", t("Government schemes", "सरकारी योजनाएँ")],
        ["/assets", t("Carbon Card & items", "कार्बन कार्ड और सामान")],
        ["/grievance", t("Help & complaints", "सहायता और शिकायत")],
      ],
    },
    {
      title: t("Transparency", "पारदर्शिता"),
      links: [
        ["/open-data", t("Open data & sealed records", "खुला डेटा और सील रिकॉर्ड")],
        ["/how-we-calculate", t("How we calculate", "हम कैसे गिनते हैं")],
        ["/methodology", t("Method & sources", "तरीका और स्रोत")],
        ["/proof", t("Check a record", "रिकॉर्ड जाँचें")],
      ],
    },
    {
      title: t("Policies", "नीतियाँ"),
      links: [
        ["/privacy", t("Privacy policy", "गोपनीयता नीति")],
        ["/policies", t("Website policies", "वेबसाइट नीतियाँ")],
        ["/policies#accessibility", t("Accessibility statement", "सुगम्यता वक्तव्य")],
        ["/policies#terms", t("Terms of use", "उपयोग की शर्तें")],
      ],
    },
  ];
  const updated = s?.lastUpdated ? new Date(s.lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <footer className="mt-16 bg-gov-navy text-white print:hidden">
      <div className="flex h-[3px]" aria-hidden>
        <span className="flex-1 bg-[#FF9933]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#138808]" />
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-10 md:grid-cols-2 md:px-10 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <div className="flex items-center gap-3">
            <Seal size={48} />
            <div className="leading-tight">
              <p className="font-devanagari text-[17px] font-semibold">कार्बन वॉलेट</p>
              <p className="font-heading text-[18px]">Carbon Wallet</p>
            </div>
          </div>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-white/75">
            {t(
              "Your home's carbon, worked out from the electricity bills you already pay and the items shops register to your card. Free for every household.",
              "आपके घर का कार्बन, आपके बिजली बिल और दुकान से जुड़े सामान से गिना गया। हर परिवार के लिए मुफ़्त।",
            )}
          </p>
          <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-white/85">
            <li className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" /> {t("Rooftop solar (PM Surya Ghar)", "छत पर सोलर (पीएम सूर्य घर)")}: <a href="tel:15555" className="font-semibold underline-offset-2 hover:underline">15555</a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" /> {t("National Consumer Helpline", "राष्ट्रीय उपभोक्ता हेल्पलाइन")}: <a href="tel:1915" className="font-semibold underline-offset-2 hover:underline">1915</a>
            </li>
          </ul>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-gov-saffron">{c.title}</p>
            <ul className="mt-3 flex flex-col gap-2 text-[13.5px]">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-white/85 underline-offset-2 hover:text-white hover:underline">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/15 bg-gov-deep">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-4 text-[12px] text-white/70 md:flex-row md:items-center md:justify-between md:px-10">
          <span>
            {s ? t(`${s.homes} homes · ${s.shops} shops · ${s.mohallas} mohallas · ${s.sealedDays} days sealed on chain`, `${s.homes} घर · ${s.shops} दुकानें · ${s.mohallas} मोहल्ले · ${s.sealedDays} दिन ब्लॉकचेन पर सील`) : " "}
            {updated ? ` · ${t("Data last updated", "डेटा अपडेट")}: ${updated}` : ""}
          </span>
          <span>{t("Grid factor: CEA CO₂ Baseline v22 · Star labels: BEE · Weather: Open-Meteo", "ग्रिड फ़ैक्टर: CEA v22 · स्टार लेबल: BEE · मौसम: Open-Meteo")}</span>
        </div>
        <div className="mx-auto max-w-[1280px] px-4 pb-4 text-[11.5px] leading-relaxed text-white/55 md:px-10">
          {t(
            "Carbon Wallet is a citizen service, not a government website. Scheme details link to the official portals; apply only there. © 2026 Carbon Wallet. Best viewed in the latest Chrome, Firefox, Safari or Edge.",
            "Carbon Wallet एक नागरिक सेवा है, सरकारी वेबसाइट नहीं। योजनाओं के लिए केवल सरकारी पोर्टल पर आवेदन करें। © 2026 Carbon Wallet।",
          )}
        </div>
      </div>
    </footer>
  );
}
