import {
  Award,
  CalendarCheck,
  BarChart3,
  Car,
  FileText,
  Fingerprint,
  Home,
  ListChecks,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Thermometer,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/** One navigation for the sidebar and the phone bottom bar, in the order a new user needs it. */
export type NavItem = { href: string; label: string; hint: string; icon: LucideIcon };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Your home",
    items: [
      { href: "/dashboard", label: "Home", hint: "This month at a glance", icon: Home },
      { href: "/check-in", label: "Weekly check-in", hint: "One minute a week", icon: CalendarCheck },
      { href: "/bills", label: "Electricity bills", hint: "Upload a bill, we read it", icon: FileText },
      { href: "/activities", label: "Activity log", hint: "Everything that added CO₂", icon: ListChecks },
      { href: "/assets", label: "Appliances & vehicles", hint: "What your home runs", icon: Car },
    ],
  },
  {
    title: "Understand",
    items: [
      { href: "/insights", label: "Insights", hint: "What caused your CO₂, and what's next", icon: Sparkles },
      { href: "/calibration", label: "AC & heat", hint: "Your AC's real power, heat vs habit", icon: Thermometer },
      { href: "/what-if", label: "What if", hint: "Try a change before you make it", icon: SlidersHorizontal },
      { href: "/leaderboard", label: "Leaderboard", hint: "How you rank", icon: Trophy },
    ],
  },
  {
    title: "Improve",
    items: [
      { href: "/actions", label: "Suggestions", hint: "Biggest savings for your home", icon: Target },
      { href: "/challenges", label: "Challenges", hint: "Streaks, points and badges", icon: Award },
      { href: "/reports", label: "Monthly report", hint: "One page, in plain words", icon: BarChart3 },
    ],
  },
  {
    title: "Your Carbon ID",
    items: [
      { href: "/carbon-id", label: "Carbon ID & card", hint: "Passbook and physical card", icon: Fingerprint },
      { href: "/proof", label: "Proof check", hint: "Lock a month so no one can edit it", icon: ShieldCheck },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/settings", label: "Settings & privacy", hint: "Reminders, your data", icon: Settings }],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Phone bottom bar: four most-used, the rest under "More". */
export const MOBILE_PRIMARY = ["/dashboard", "/bills", "/insights", "/carbon-id"];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
