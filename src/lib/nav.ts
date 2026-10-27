import type { Lang } from "@/lib/languages";
import {
  Award,
  CalendarCheck,
  BarChart3,
  BookOpen,
  LifeBuoy,
  CreditCard,
  FileText,
  Flame,
  Home,
  Landmark,
  ListChecks,
  MapPinned,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Thermometer,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * One navigation for the sidebar, the phone bottom bar and the phone menu.
 * Five main places, each with an icon and a two-word label in English and Hindi; everything else sits under "More".
 */
export type NavItem = {
  href: string;
  en: string;
  hi: string;
  hint: string;
  icon: LucideIcon;
  /** other pages that light up this item */
  also?: string[];
  ownerOnly?: boolean;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", en: "My home", hi: "मेरा घर", hint: "This month's carbon, in one look", icon: Home },
  { href: "/bills", en: "Electricity bill", hi: "बिजली बिल", hint: "Add a bill photo, we read it", icon: FileText },
  { href: "/mohalla", en: "My mohalla", hi: "मोहल्ला", hint: "Your area, weather and air", icon: MapPinned },
  {
    href: "/assets",
    en: "Card & items",
    hi: "कार्ड और सामान",
    hint: "Carbon Card and what your home owns",
    icon: CreditCard,
    also: ["/carbon-id"],
  },
  { href: "/yojana", en: "Govt schemes", hi: "सरकारी योजना", hint: "Subsidies and free help you can get", icon: Landmark },
];

export const MORE_NAV: NavItem[] = [
  { href: "/heatmap", en: "Heat map", hi: "हीट मैप", hint: "Carbon per person, area by area", icon: Flame },
  { href: "/insights", en: "What caused it", hi: "कारण", hint: "What raised or lowered your carbon", icon: Sparkles },
  { href: "/actions", en: "Ways to save", hi: "बचत के तरीके", hint: "Biggest savings for your home", icon: Target },
  { href: "/reports", en: "Monthly report", hi: "मासिक रिपोर्ट", hint: "One page, in plain words", icon: BarChart3 },
  { href: "/calibration", en: "AC & heat", hi: "एसी और गर्मी", hint: "Your AC's real power, heat vs habit", icon: Thermometer },
  { href: "/what-if", en: "Try a change", hi: "बदलाव आज़माएँ", hint: "See the saving before you change", icon: SlidersHorizontal },
  { href: "/check-in", en: "Weekly check-in", hi: "हफ़्ते की जाँच", hint: "One minute a week", icon: CalendarCheck, ownerOnly: true },
  { href: "/activities", en: "Activity log", hi: "गतिविधि", hint: "Everything that added CO₂", icon: ListChecks },
  { href: "/challenges", en: "Challenges", hi: "चुनौतियाँ", hint: "Streaks, points and badges", icon: Award },
  { href: "/leaderboard", en: "Leaderboard", hi: "रैंकिंग", hint: "How homes compare", icon: Trophy },
  { href: "/proof", en: "Proof check", hi: "प्रमाण", hint: "Lock a month so no one can edit it", icon: ShieldCheck },
  { href: "/how-we-calculate", en: "How we calculate", hi: "हम कैसे गिनते हैं", hint: "The method, in plain words", icon: BookOpen },
  { href: "/grievance", en: "Help & complaints", hi: "सहायता और शिकायत", hint: "Get a ticket number and a reply", icon: LifeBuoy },
];

export const SETTINGS_NAV: NavItem = {
  href: "/settings",
  en: "Settings",
  hi: "सेटिंग",
  hint: "Family, reminders, your data",
  icon: Settings,
};

export const ALL_NAV: NavItem[] = [...MAIN_NAV, ...MORE_NAV, SETTINGS_NAV];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isItemActive(pathname: string, item: NavItem) {
  return [item.href, ...(item.also ?? [])].some((h) => isActive(pathname, h));
}

export function navLabel(item: NavItem, lang: Lang) {
  return lang === "hi" ? item.hi : item.en;
}
