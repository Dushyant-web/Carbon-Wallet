import { db } from "@/server/db";
import { stateInfo } from "@/lib/allowance";
import { INDIA_INVENTORY, OFFICIAL, monthlyKg } from "@/lib/officialData";
import { minHomes } from "./mohalla.service";
import { portalStats } from "./portal.service";
import { toCsv } from "@/lib/catalogue";

/*
 * Open data: everything here is public on purpose. Area totals only where at least the privacy minimum of homes
 * contribute; the chain seal register; the official figures and scheme sources the app relies on.
 */
export async function openData() {
  const min = minHomes();
  const [stats, rows, batches, schemes] = await Promise.all([
    portalStats(),
    db.areaStat.findMany({ where: { homes: { gte: min }, level: { in: ["INDIA", "STATE", "CITY", "MOHALLA"] } }, orderBy: [{ month: "desc" }, { level: "asc" }] }),
    db.anchorBatch.findMany({ orderBy: { day: "desc" }, take: 30 }),
    db.scheme.findMany({ where: { status: { not: "HIDDEN" } }, orderBy: { name: "asc" } }),
  ]);
  const mohallaNames = new Map((await db.mohalla.findMany({ select: { id: true, name: true } })).map((m) => [m.id, m.name]));
  const area = rows.map((r) => ({
    level: r.level,
    name:
      r.level === "INDIA" ? "India" : r.level === "STATE" ? stateInfo(r.key).name : r.level === "CITY" ? `${r.key.split("|")[0]}, ${r.key.split("|")[1]}` : mohallaNames.get(r.key) ?? "Mohalla",
    month: r.month,
    homes: r.homes,
    people: r.people,
    kgPerPerson: r.kgPerPerson,
    byCategory: JSON.parse(r.byCategory) as Record<string, number>,
  }));
  return {
    minHomes: min,
    stats,
    area,
    seals: batches.map((b) => ({ day: b.day, records: b.leaves, root: b.root, txHash: b.txHash, status: b.status })),
    official: Object.values(OFFICIAL).map((o) => ({ ...o, monthlyKg: monthlyKg(o.perCapitaT) })),
    inventory: INDIA_INVENTORY,
    schemes: schemes.map((s) => ({ name: s.name, link: s.link, sourceUrl: s.sourceUrl, lastChecked: s.lastChecked.toISOString(), status: s.status })),
  };
}

export async function openDataCsv() {
  const d = await openData();
  return toCsv([
    ["level", "area", "month", "homes", "people", "kg_co2_per_person", "electricity", "cooking", "transport", "other"],
    ...d.area.map((a) => {
      const c = a.byCategory;
      const known = (c.Electricity ?? 0) + (c.Cooking ?? 0) + (c.Transport ?? 0);
      const all = Object.values(c).reduce((x, y) => x + y, 0);
      return [a.level, a.name, a.month, a.homes, a.people, a.kgPerPerson, c.Electricity ?? "", c.Cooking ?? "", c.Transport ?? "", Math.round((all - known) * 10) / 10];
    }),
  ]);
}
