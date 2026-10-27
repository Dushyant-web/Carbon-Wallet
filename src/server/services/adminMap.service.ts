import { cellToBoundary, cellToLatLng, cellToParent, cellsToMultiPolygon } from "h3-js";
import { db } from "@/server/db";
import { stateCode } from "@/lib/carbonId";
import { stateAveragePerPerson, stateInfo, statusFor, type CarbonStatus } from "@/lib/allowance";
import { INDIA_INVENTORY, OFFICIAL, monthlyKg } from "@/lib/officialData";
import { minHomes } from "./mohalla.service";
import { personAllowance } from "./allowance.service";

/*
 * The admin's carbon map. Admins can already read any home, so here each home appears as its own small hexagon
 * coloured green / amber / red, never with a name or an exact point. States are drawn as a tile grid rather than
 * a map: a geographic map of India must show the boundaries as the Survey of India publishes them, which the free
 * map tiles we use don't.
 */

// A tile grid of India (column, row), roughly where each state sits
export const STATE_TILES: Record<string, [number, number]> = {
  JK: [3, 0], LA: [4, 0],
  CH: [2, 1], HP: [3, 1], UK: [4, 1], AR: [8, 1],
  PB: [2, 2], HR: [3, 2], DL: [4, 2], SK: [6, 2], AS: [7, 2], NL: [8, 2],
  RJ: [2, 3], UP: [4, 3], BR: [5, 3], WB: [6, 3], ML: [7, 3], MN: [8, 3],
  GJ: [1, 4], MP: [3, 4], JH: [5, 4], TR: [7, 4], MZ: [8, 4],
  CG: [4, 5], OD: [5, 5],
  MH: [2, 6], TS: [3, 6],
  GA: [2, 7], KA: [3, 7], AP: [4, 7],
  KL: [3, 8], TN: [4, 8], PY: [5, 8],
};

export async function adminCarbonMap(requested?: string | null) {
  const min = minHomes();
  const latest = await db.areaStat.findFirst({ where: { level: "INDIA" }, orderBy: [{ homes: "desc" }, { month: "desc" }], select: { month: true } });
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : latest?.month ?? null;

  const [homes, demoHomes, shops, sealed, mohallaRows, stats] = await Promise.all([
    db.household.count({ where: { status: "ACTIVE" } }),
    db.household.count({ where: { status: "ACTIVE", demo: true } }),
    db.merchant.count({ where: { status: "APPROVED" } }),
    db.anchorBatch.count(),
    db.mohalla.findMany({ orderBy: { homes: "desc" } }),
    month ? db.areaStat.findMany({ where: { month } }) : Promise.resolve([]),
  ]);
  const stat = (level: string, key: string) => stats.find((s) => s.level === level && s.key === key) ?? null;

  const states = Object.entries(STATE_TILES).map(([code, [x, y]]) => {
    const s = stat("STATE", code);
    const info = stateInfo(code);
    return {
      code,
      name: info.name,
      x,
      y,
      homes: s?.homes ?? 0,
      kgPerPerson: s ? s.kgPerPerson : null,
      shareable: !!s && s.homes >= min,
      estimateKg: stateAveragePerPerson(code).total,
      official: code === "UP" ? { perCapitaT: OFFICIAL.UP.perCapitaT, monthlyKg: monthlyKg(OFFICIAL.UP.perCapitaT), year: OFFICIAL.UP.year } : null,
    };
  });

  const cities = stats
    .filter((s) => s.level === "CITY")
    .map((s) => ({ name: s.key.split("|")[0], state: s.key.split("|")[1], homes: s.homes, kgPerPerson: s.kgPerPerson }))
    .sort((a, b) => b.homes - a.homes);

  const mohallas = mohallaRows.map((m) => {
    const s = stat("MOHALLA", m.id);
    return { id: m.id, name: m.name, city: m.city, state: m.state, homes: m.homes, kgPerPerson: s?.kgPerPerson ?? null };
  });

  const india = stat("INDIA", "IN");
  return {
    month,
    minHomes: min,
    kpis: { homes, demoHomes, shops, mohallas: mohallaRows.length, cities: cities.length, sealedDays: sealed, indiaKgPerPerson: india?.kgPerPerson ?? null },
    states,
    cities,
    mohallas,
    official: { india: { ...OFFICIAL.INDIA, monthlyKg: monthlyKg(OFFICIAL.INDIA.perCapitaT) }, up: { ...OFFICIAL.UP, monthlyKg: monthlyKg(OFFICIAL.UP.perCapitaT) }, noida: { ...OFFICIAL.NOIDA, monthlyKg: monthlyKg(OFFICIAL.NOIDA.perCapitaT) }, inventory: INDIA_INVENTORY },
  };
}

/** One mohalla on the map: its outline, and each home's own small hexagon coloured by its status that month. */
export async function adminMohallaCells(mohallaId: string, month: string | null) {
  const m = await db.mohalla.findUnique({ where: { id: mohallaId } });
  if (!m) return null;
  const locs = await db.householdLocation.findMany({
    where: { mohallaId },
    select: { h3Cell: true, householdId: true, household: { select: { name: true, carbonId: true, size: true, state: true, demo: true } } },
  });
  const sums = month
    ? await db.monthlySummary.findMany({ where: { householdId: { in: locs.map((l) => l.householdId) }, month }, select: { householdId: true, totalKg: true } })
    : [];
  const byHome = new Map(sums.map((s) => [s.householdId, s.totalKg]));
  const avg = personAllowance();
  const counts: Record<CarbonStatus | "NONE", number> = { GREEN: 0, AMBER: 0, RED: 0, NONE: 0 };
  const cells = locs.map((l) => {
    const kg = byHome.get(l.householdId);
    const status: CarbonStatus | "NONE" = kg === undefined ? "NONE" : statusFor(kg, avg.perPersonKg * Math.max(1, l.household.size));
    counts[status]++;
    return {
      cell: l.h3Cell,
      ring: cellToBoundary(l.h3Cell) as [number, number][],
      status,
      name: l.household.name,
      carbonId: l.household.carbonId,
      people: l.household.size,
      kgPerPerson: kg === undefined ? null : Math.round((kg / Math.max(1, l.household.size)) * 10) / 10,
    };
  });
  const parents = [...new Set(locs.map((l) => cellToParent(l.h3Cell, 9)))];
  const outline = parents.length ? cellsToMultiPolygon(parents).map((p) => p[0] as [number, number][]) : [];
  return {
    mohalla: { id: m.id, name: m.name, city: m.city, state: stateCode(m.state), homes: m.homes, center: cellToLatLng(m.h3Area) as [number, number] },
    average: avg,
    counts,
    cells,
    outline,
  };
}
