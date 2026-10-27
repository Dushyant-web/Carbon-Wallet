import { cookies } from "next/headers";
import { Partner } from "@/components/partner/Partner";
import { GovHeader } from "@/components/gov/GovHeader";
import { PortalNav, type PortalLink } from "@/components/gov/PortalNav";
import { AppFooter } from "@/components/layout/AppFooter";
import { UiPrefsProvider } from "@/components/providers/UiPrefsProvider";
import { UI_COOKIE, parseUiPrefs } from "@/lib/uiPrefs";

const LINKS: PortalLink[] = [
  { href: "/", en: "Home", hi: "होम", exact: true },
  { href: "/open-data", en: "Open data & records", hi: "खुला डेटा" },
  { href: "/policies", en: "Website policies", hi: "वेबसाइट नीतियाँ" },
  { href: "/methodology", en: "Method & sources", hi: "तरीका और स्रोत" },
  { href: "/login", en: "Log in", hi: "लॉग इन" },
];

/** Public pages anyone can read without an account: open data, policies. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const prefs = parseUiPrefs((await cookies()).get(UI_COOKIE)?.value);
  return (
    <UiPrefsProvider initial={prefs}>
      <div className="min-h-screen bg-canvas">
        <GovHeader service="Open data · Citizen Carbon Service" serviceHi="खुला डेटा · नागरिक कार्बन सेवा" home="/" />
        <PortalNav links={LINKS} />
        <main id="main" className="mx-auto max-w-[1280px] px-4 py-8 md:px-10">{children}</main>
        <AppFooter />
      </div>
      <Partner audience="guest" />
    </UiPrefsProvider>
  );
}
