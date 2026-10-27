import { cellToParent, cellsToMultiPolygon } from "h3-js";
import { db } from "@/server/db";
import { ALLOWANCE_PER_PERSON_KG } from "@/lib/allowance";
import { minHomes } from "./mohalla.service";

export type HeatArea = {
  id: string;
  name: string;
  city: string;
  state: string;
  homes: number;
  kgPerPerson: number;
  /** outer rings, [lat, lng] */
  outline: [number, number][][];
};

export type HeatMap = { month: string | null; minHomes: number; allowancePerPersonKg: number; areas: HeatArea[] };

// The same for every viewer and only changes with the nightly area job, so each server instance keeps it a while
const TTL_MS = 10 * 60_000;
let cached: { at: number; value: HeatMap } | null = null;

/**
 * Carbon per person in every mohalla big enough to show (the 20-home privacy minimum), for the newest month that
 * has one. Outlines come from groups of homes (H3 resolution 9), never a single house.
 */
export async function heatMap(): Promise<HeatMap> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const min = minHomes();
  const newest = await db.areaStat.findFirst({ where: { level: "MOHALLA", homes: { gte: min } }, orderBy: { month: "desc" }, select: { month: true } });
  const month = newest?.month ?? null;
  const stats = month ? await db.areaStat.findMany({ where: { level: "MOHALLA", month, homes: { gte: min } } }) : [];
  const ids = stats.map((s) => s.key);
  const [mohallas, cells] = await Promise.all([
    db.mohalla.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, city: true, state: true } }),
    db.householdLocation.findMany({ where: { mohallaId: { in: ids } }, select: { mohallaId: true, h3Cell: true } }),
  ]);

  const cellsBy = new Map<string, Set<string>>();
  for (const c of cells) {
    if (!c.mohallaId) continue;
    const set = cellsBy.get(c.mohallaId) ?? new Set<string>();
    set.add(cellToParent(c.h3Cell, 9));
    cellsBy.set(c.mohallaId, set);
  }
  const byId = new Map(mohallas.map((m) => [m.id, m]));
  const areas: HeatArea[] = stats
    .map((s) => {
      const m = byId.get(s.key);
      const parents = cellsBy.get(s.key);
      if (!m || !parents?.size) return null;
      return {
        id: m.id,
        name: m.name,
        city: m.city,
        state: m.state,
        homes: s.homes,
        kgPerPerson: s.kgPerPerson,
        outline: cellsToMultiPolygon([...parents]).map((poly) => poly[0] as [number, number][]),
      };
    })
    .filter((a): a is HeatArea => a !== null)
    .sort((a, b) => b.kgPerPerson - a.kgPerPerson);

  const value = { month, minHomes: min, allowancePerPersonKg: ALLOWANCE_PER_PERSON_KG, areas };
  cached = { at: Date.now(), value };
  return value;
}
