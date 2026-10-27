import { cookies } from "next/headers";
import { RouteWarmup } from "@/components/layout/RouteWarmup";
import { MAIN_NAV, MORE_NAV } from "@/lib/nav";
import { Partner } from "@/components/partner/Partner";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { GovHeader } from "@/components/gov/GovHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { CreateHouseholdModal } from "@/components/dashboard/CreateHouseholdModal";
import { LogActivityModal } from "@/components/dashboard/LogActivityModal";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { ConsentBanner } from "@/components/settings/ConsentBanner";
import { UiPrefsProvider } from "@/components/providers/UiPrefsProvider";
import { AppMain } from "@/components/layout/AppMain";
import { UI_COOKIE, parseUiPrefs } from "@/lib/uiPrefs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.platformRole === "MERCHANT") redirect("/merchant"); // shops have their own counter, never a household
  const prefs = parseUiPrefs((await cookies()).get(UI_COOKIE)?.value);

  return (
    <UiPrefsProvider initial={prefs}>
      <PwaProvider>
        <div className="min-h-screen bg-canvas">
          <GovHeader service="Household carbon account · Citizen Carbon Service" serviceHi="घरेलू कार्बन खाता · नागरिक कार्बन सेवा" />
          <div className="flex">
            <Sidebar isAdmin={user.platformRole === "ADMIN"} />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar user={user} />
              <AppMain>{children}</AppMain>
              <div className="pb-[68px] lg:pb-0">
                <AppFooter />
              </div>
            </div>
          </div>
        </div>
        <BottomNav />
        <CreateHouseholdModal />
        {/* outside the page fade-in (its transform would pin a fixed overlay to the page), and on every page */}
        <LogActivityModal />
        <Partner audience="household" />
        <RouteWarmup hrefs={[...MAIN_NAV, ...MORE_NAV].map((i) => i.href)} />
        <ConsentBanner />
      </PwaProvider>
    </UiPrefsProvider>
  );
}
