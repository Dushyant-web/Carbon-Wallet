import { db } from "@/server/db";

/*
 * What the public-portal chrome shows: the "What's new" ticker and the footer's live counts. Everything here is
 * already public (scheme terms, totals of homes and shops, the day's chain seal), never anything about one home.
 */

export type Update = { en: string; hi: string; href: string; tag: "SCHEME" | "SEAL" | "MOHALLA" | "PORTAL" };

const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// every page's ticker and footer ask for this: compute it at most once a minute per server
let memo: { at: number; value: Promise<{ updates: Update[]; stats: PortalStats }> } | null = null;

export function portalUpdates(): Promise<{ updates: Update[]; stats: PortalStats }> {
  if (!memo || Date.now() - memo.at > 60_000) {
    const value = buildUpdates();
    memo = { at: Date.now(), value };
    value.catch(() => (memo = null));
  }
  return memo.value;
}

async function buildUpdates(): Promise<{ updates: Update[]; stats: PortalStats }> {
  const [schemes, seal, mohallas, stats] = await Promise.all([
    db.scheme.findMany({ where: { status: "ACTIVE" }, orderBy: { lastChecked: "desc" }, take: 6 }),
    db.anchorBatch.findFirst({ orderBy: { day: "desc" } }),
    db.mohalla.findMany({ orderBy: { homes: "desc" }, take: 2 }),
    portalStats(),
  ]);
  const updates: Update[] = [];
  for (const m of mohallas.filter((x) => x.homes >= 20)) {
    updates.push({ tag: "MOHALLA", en: `${m.name}: ${m.homes} homes now share their mohalla news`, hi: `${m.name}: ${m.homes} घर अब मोहल्ला समाचार में`, href: "/mohalla" });
  }
  for (const s of schemes) {
    updates.push({
      tag: "SCHEME",
      en: `${s.name}: ${s.benefit}${s.validUntil ? ` Till ${date(s.validUntil)}.` : ""}`,
      hi: `${s.nameHi}: ${s.benefitHi}`,
      href: "/yojana",
    });
  }
  if (seal) {
    updates.push({
      tag: "SEAL",
      en: `${seal.leaves} records of ${seal.day} sealed on the blockchain; anyone can check them`,
      hi: `${seal.day} के ${seal.leaves} रिकॉर्ड ब्लॉकचेन पर सील; कोई भी जाँच सकता है`,
      href: "/open-data",
    });
  }
  updates.push({
    tag: "PORTAL",
    en: `${stats.homes} homes and ${stats.shops} registered shops on Carbon Wallet`,
    hi: `Carbon Wallet पर ${stats.homes} घर और ${stats.shops} पंजीकृत दुकानें`,
    href: "/open-data",
  });
  return { updates, stats };
}

export type PortalStats = { homes: number; shops: number; mohallas: number; sealedDays: number; lastUpdated: string | null };

export async function portalStats(): Promise<PortalStats> {
  const [homes, shops, mohallas, sealedDays, latest] = await Promise.all([
    db.household.count({ where: { status: "ACTIVE" } }),
    db.merchant.count({ where: { status: "APPROVED" } }),
    db.mohalla.count(),
    db.anchorBatch.count(),
    db.areaStat.findFirst({ orderBy: { computedAt: "desc" }, select: { computedAt: true } }),
  ]);
  return { homes, shops, mohallas, sealedDays, lastUpdated: latest?.computedAt.toISOString() ?? null };
}
