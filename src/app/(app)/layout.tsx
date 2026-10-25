import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { CreateHouseholdModal } from "@/components/dashboard/CreateHouseholdModal";
import { LogActivityModal } from "@/components/dashboard/LogActivityModal";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { ConsentBanner } from "@/components/settings/ConsentBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.platformRole === "MERCHANT") redirect("/merchant"); // shops have their own counter, never a household

  return (
    <PwaProvider>
      <div className="flex min-h-screen">
        <Sidebar isAdmin={user.platformRole === "ADMIN"} />
        <div className="flex-1 pl-0 lg:pl-60">
          <TopBar user={user} />
          <main className="pt-16 min-h-screen px-4 md:px-10 pb-24 lg:pb-12 bg-canvas">
            <div className="mx-auto max-w-[1280px] pt-6 md:pt-8">{children}</div>
          </main>
        </div>
      </div>
      <BottomNav />
      <CreateHouseholdModal />
      {/* outside the page fade-in (its transform would pin a fixed overlay to the page), and on every page */}
      <LogActivityModal />
      <ConsentBanner />
    </PwaProvider>
  );
}
