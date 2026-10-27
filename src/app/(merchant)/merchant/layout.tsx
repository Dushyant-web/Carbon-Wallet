import { cookies } from "next/headers";
import { RouteWarmup } from "@/components/layout/RouteWarmup";
import { Partner } from "@/components/partner/Partner";
import { redirect } from "next/navigation";
import { GovHeader } from "@/components/gov/GovHeader";
import { PortalNav, type PortalLink } from "@/components/gov/PortalNav";
import { AppFooter } from "@/components/layout/AppFooter";
import { UiPrefsProvider } from "@/components/providers/UiPrefsProvider";
import { UI_COOKIE, parseUiPrefs } from "@/lib/uiPrefs";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MERCHANT_STATUS_LABEL } from "@/lib/merchant";

export const metadata = { title: "Shop counter" };

const LINKS: PortalLink[] = [
  { href: "/merchant", en: "Dashboard", hi: "डैशबोर्ड", exact: true },
  { href: "/merchant/counter", en: "Counter", hi: "काउंटर" },
  { href: "/merchant/catalogue", en: "Catalogue", hi: "कैटलॉग" },
  { href: "/merchant/sales", en: "Registered items", hi: "दर्ज सामान" },
  { href: "/merchant/help", en: "Help & complaints", hi: "सहायता" },
];

/** The shop's side of Carbon Wallet: scan a customer's card, register what they bought. Approved shops only. */
export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/merchant/login");
  if (user.platformRole !== "MERCHANT") redirect(user.platformRole === "ADMIN" ? "/admin" : "/dashboard");
  const merchant = await db.merchant.findUnique({ where: { userId: user.id } });
  if (!merchant) redirect("/merchant/signup");

  const approved = merchant.status === "APPROVED";
  const prefs = parseUiPrefs((await cookies()).get(UI_COOKIE)?.value);

  return (
    <UiPrefsProvider initial={prefs}>
    <div className="min-h-screen bg-canvas">
      <GovHeader service={`Shop portal · ${merchant.businessName}, ${merchant.city}`} serviceHi={`दुकान पोर्टल · ${merchant.businessName}, ${merchant.city}`} home="/merchant" />
      <PortalNav
        links={approved ? LINKS : []}
        right={
          <>
            <NotificationBell allHref="/merchant/notifications" variant="dark" />
            <span className="hidden truncate text-white/80 md:inline">{merchant.businessName}</span>
            <LogoutButton redirectTo="/merchant/login" />
          </>
        }
      />
      <main id="main" className="mx-auto max-w-[1280px] px-4 py-8 md:px-10">
        {approved ? (
          children
        ) : (
          <section className="max-w-xl border border-ink bg-canvas-card p-6">
            <span className="label-caps">{MERCHANT_STATUS_LABEL[merchant.status] ?? merchant.status}</span>
            <h1 className="mt-2 font-heading text-3xl font-medium tracking-tight">{merchant.businessName}</h1>
            {merchant.status === "PENDING" ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Thanks for registering. Carbon Wallet checks every shop before it can scan customers&apos; cards, because a
                card lets you add items to someone&apos;s home. You&apos;ll see the counter here as soon as you&apos;re approved.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                This shop can&apos;t scan cards right now. If you think this is a mistake, contact Carbon Wallet.
              </p>
            )}
          </section>
        )}
      </main>
      <AppFooter />
    </div>
    {approved && <Partner audience="merchant" />}
    {approved && <RouteWarmup hrefs={LINKS.map((l) => l.href)} />}
    </UiPrefsProvider>
  );
}
