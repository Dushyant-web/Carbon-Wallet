import type { PassbookView } from "@/components/passbook/CarbonPassbook";
import { LandingPage } from "@/components/landing/LandingPage";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Your home's carbon, measured" };

const SAMPLE_PASSBOOK: PassbookView = {
  carbonId: "CW-XX-26-0000-0", // a sample ID, not a real household
  household: { name: "Your Home", city: "Your city", state: "IN", size: 4, issuedOn: "2026-01-12T00:00:00.000Z" },
  current: { totalKg: 286, perPersonKg: 72 },
  months: [
    { month: "2025-10", label: "Oct 2025", totalKg: 337.2, deltaPct: null, status: "ANCHORED", batchId: 1 },
    { month: "2025-11", label: "Nov 2025", totalKg: 330.9, deltaPct: -1.9, status: "ANCHORED", batchId: 2 },
    { month: "2025-12", label: "Dec 2025", totalKg: 324.7, deltaPct: -1.9, status: "ANCHORED", batchId: 3 },
    { month: "2026-01", label: "Jan 2026", totalKg: 318.4, deltaPct: -1.9, status: "ANCHORED", batchId: 4 },
    { month: "2026-02", label: "Feb 2026", totalKg: 312.2, deltaPct: -1.9, status: "RECORDED", batchId: null },
    { month: "2026-03", label: "Mar 2026", totalKg: 286, deltaPct: -8.4, status: "OPEN", batchId: null },
  ],
};

export default async function Page() {
  const user = await getCurrentUser();
  // One way in: admins go to the admin panel, shops to their counter, everyone else to their dashboard
  const cta = user
    ? user.platformRole === "ADMIN"
      ? { href: "/admin", label: "Open admin panel" }
      : user.platformRole === "MERCHANT"
        ? { href: "/merchant", label: "Open shop counter" }
        : { href: "/dashboard", label: "Open dashboard" }
    : { href: "/signup", label: "Start with one bill", secondary: { href: "/login", label: "Log in" } };
  return <LandingPage cta={cta} loggedIn={!!user} sample={SAMPLE_PASSBOOK} />;
}
