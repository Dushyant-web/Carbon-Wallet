import { cookies } from "next/headers";
import { RouteWarmup } from "@/components/layout/RouteWarmup";
import { Partner } from "@/components/partner/Partner";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GovHeader } from "@/components/gov/GovHeader";
import { PortalNav, type PortalLink } from "@/components/gov/PortalNav";
import { AppFooter } from "@/components/layout/AppFooter";
import { UiPrefsProvider } from "@/components/providers/UiPrefsProvider";
import { UI_COOKIE, parseUiPrefs } from "@/lib/uiPrefs";

export const metadata = { title: "Admin" };

const LINKS: PortalLink[] = [
  { href: "/admin", en: "Overview", hi: "सारांश", exact: true },
  { href: "/admin/map", en: "Carbon map", hi: "कार्बन नक्शा" },
  { href: "/admin/households", en: "Households", hi: "घर" },
  { href: "/admin/merchants", en: "Shops", hi: "दुकानें" },
  { href: "/admin/removals", en: "Removals", hi: "हटाने के अनुरोध" },
  { href: "/admin/grievances", en: "Complaints", hi: "शिकायतें" },
  { href: "/admin/schemes", en: "Schemes", hi: "योजनाएँ" },
  { href: "/admin/ml", en: "AI forecast", hi: "AI अनुमान" },
  { href: "/admin/reader", en: "Card reader", hi: "कार्ड रीडर" },
  { href: "/dashboard", en: "Open app", hi: "ऐप खोलें" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.platformRole !== "ADMIN") redirect(user.platformRole === "MERCHANT" ? "/merchant" : "/dashboard?denied=admin");
  const prefs = parseUiPrefs((await cookies()).get(UI_COOKIE)?.value);

  return (
    <UiPrefsProvider initial={prefs}>
      <div className="min-h-screen bg-canvas">
        <GovHeader service="Administration · Citizen Carbon Service" serviceHi="प्रशासन · नागरिक कार्बन सेवा" home="/admin" />
        <PortalNav
          links={LINKS}
          right={
            <>
              <NotificationBell allHref="/admin/notifications" variant="dark" />
              <span className="hidden text-white/80 lg:inline">{user.email}</span>
              <LogoutButton redirectTo="/admin/login" />
            </>
          }
        />
        <main id="main" className="mx-auto max-w-[1280px] px-4 py-8 md:px-10">{children}</main>
        <AppFooter />
      </div>
      <Partner audience="admin" />
      <RouteWarmup hrefs={LINKS.map((l) => l.href)} />
    </UiPrefsProvider>
  );
}
