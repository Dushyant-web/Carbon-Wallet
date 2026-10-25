import { db } from "@/server/db";
import { COUNTED_ACTIVITY } from "@/server/counted";
import { engineShapley, EngineError } from "@/server/engine";
import { monthLabel, resolveReportingPeriod, shiftMonth } from "@/server/period";

/**
 * "What caused my CO2?" for one household:
 *  1. a months × sources table of real kg (bills, each vehicle, flights, food, waste, ...)
 *  2. Shapley values (SHAP) per month: how much each source pushed that month above or below the average month
 *  3. an estimated split of the month's electricity across appliances, and transport across vehicles
 *  4. a handful of facts + template sentences (an LLM can reword these; it can't add numbers)
 */

type SourceMeta = { key: string; label: string; kind: "electricity" | "vehicle" | "travel" | "food" | "waste" | "other"; vehicleId?: string };

export type MonthInsight = {
  month: string;
  label: string;
  totalKg: number;
  diffKg: number; // vs average month
  drivers: { source: string; kg: number }[]; // Shapley values, sorted by size
};

export type Insights = {
  available: boolean;
  reason: string | null;
  method: string | null;
  baseKg: number;
  months: MonthInsight[];
  sources: { source: string; totalKg: number; sharePct: number; kind: string }[];
  heat: { source: string; values: number[] }[]; // kg per month, same order as months
  peak: { month: string; label: string; kg: number; driver: string | null; driverKg: number | null } | null;
  focusMonth: string | null;
  appliances: { name: string; type: string; kg: number; sharePct: number; basis: string }[];
  vehicles: { name: string; fuel: string; kg: number; basis: string }[];
  facts: Record<string, unknown>;
  bullets: string[];
};

const TYPE_LABEL: Record<string, string> = {
  ac_cooling: "AC (logged hours)",
  grid_electricity: "Electricity (logged)",
  grocery_basket: "Food & groceries",
  flight_domestic_economy: "Flights",
  flight_domestic_business: "Flights",
  city_bus: "Bus",
  intercity_train: "Train",
  solid_waste_unsegregated: "Waste",
  metro_transit: "Metro",
};
const FUEL_OF_TYPE: Record<string, string> = {
  petrol_car: "Petrol",
  petrol_fuel: "Petrol",
  diesel_car: "Diesel",
  diesel_fuel: "Diesel",
  cng_car: "CNG",
  cng_fuel: "CNG",
  electric_vehicle: "Electric",
  two_wheeler_petrol: "Petrol",
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function getInsights(householdId: string, focus?: string | null): Promise<Insights> {
  const period = await resolveReportingPeriod(householdId);
  const empty = (reason: string): Insights => ({
    available: false, reason, method: null, baseKg: 0, months: [], sources: [], heat: [], peak: null, focusMonth: null,
    appliances: [], vehicles: [], facts: {}, bullets: [],
  });
  if (!period.hasData) return empty("No emissions recorded yet. Add a bill or log an activity first.");

  // Up to 12 months ending at the reporting month
  const last = period.month;
  const first = shiftMonth(last, -11);
  const [household, events, fuelLogs, calibration, recs] = await Promise.all([
    db.household.findUnique({ where: { id: householdId }, include: { appliances: true, vehicles: true } }),
    db.emissionEvent.findMany({
      where: {
        householdId,
        occurredOn: { gte: new Date(`${first}-01T00:00:00Z`), lt: new Date(`${shiftMonth(last, 1)}-01T00:00:00Z`) },
        activity: COUNTED_ACTIVITY,
      },
      select: { kgCo2e: true, occurredOn: true, activity: { select: { id: true, category: true, type: true, billId: true } } },
    }),
    db.fuelLog.findMany({ where: { householdId }, select: { activityId: true, vehicleId: true } }),
    db.calibration.findFirst({ where: { householdId, method: { not: "default" } }, orderBy: { createdAt: "desc" } }),
    db.recommendation.findMany({ where: { householdId, status: "PENDING" }, orderBy: { kgSaved: "desc" }, take: 1 }),
  ]);
  if (!household) return empty("Household not found.");

  const vehicles = household.vehicles;
  const fuelByActivity = new Map(fuelLogs.filter((f) => f.activityId).map((f) => [f.activityId!, f.vehicleId]));
  const vehicleLabel = (v: (typeof vehicles)[number]) => `${v.name ?? v.type} (${v.fuel.toLowerCase()})`;

  // Name each event's source: bills, a specific vehicle, or a category
  const meta = new Map<string, SourceMeta>();
  const sourceOf = (a: { id: string; category: string; type: string; billId: string | null }): SourceMeta => {
    if (a.billId) return { key: "bill", label: "Electricity bills", kind: "electricity" };
    if (a.category === "Electricity") return { key: a.type, label: TYPE_LABEL[a.type] ?? "Electricity (logged)", kind: "electricity" };
    if (a.category === "Transport") {
      const vid = fuelByActivity.get(a.id);
      const fuel = FUEL_OF_TYPE[a.type];
      const v = vid ? vehicles.find((x) => x.id === vid) : fuel ? vehicles.filter((x) => x.fuel === fuel).length === 1 ? vehicles.find((x) => x.fuel === fuel) : undefined : undefined;
      if (v) return { key: `veh:${v.id}`, label: vehicleLabel(v), kind: "vehicle", vehicleId: v.id };
      return { key: a.type, label: TYPE_LABEL[a.type] ?? `${fuel ?? "Other"} vehicle trips`, kind: a.type === "metro_transit" ? "travel" : "vehicle" };
    }
    if (a.category === "Travel") return { key: a.type, label: TYPE_LABEL[a.type] ?? "Trips", kind: "travel" };
    if (a.type === "lpg_cooking") return { key: "lpg", label: "Cooking gas (LPG)", kind: "food" };
    if (a.category === "Food") return { key: "food", label: "Food & groceries", kind: "food" };
    if (a.category === "Refrigerant") return { key: "refrigerant", label: "AC gas refills", kind: "other" };
    if (a.category === "Waste") return { key: "waste", label: "Waste", kind: "waste" };
    return { key: a.type, label: a.type.replace(/_/g, " "), kind: "other" };
  };

  const byMonth = new Map<string, Map<string, number>>();
  for (const e of events) {
    const m = e.occurredOn.toISOString().slice(0, 7);
    const s = sourceOf(e.activity);
    meta.set(s.label, s);
    const row = byMonth.get(m) ?? new Map<string, number>();
    row.set(s.label, (row.get(s.label) ?? 0) + e.kgCo2e);
    byMonth.set(m, row);
  }
  const months = [...byMonth.keys()].filter((m) => m <= last).sort();
  if (months.length < 2) return empty("Insights need at least two months of data.");
  const sources = [...meta.keys()];
  const matrix = months.map((m) => sources.map((s) => r1(byMonth.get(m)?.get(s) ?? 0)));

  let shap;
  try {
    shap = await engineShapley(months, sources, matrix);
  } catch (err) {
    if (err instanceof EngineError) return empty("The calculation engine is offline, so insights can't be worked out right now.");
    throw err;
  }

  const monthInsights: MonthInsight[] = months.map((m, i) => ({
    month: m,
    label: monthLabel(m),
    totalKg: shap.totals[i],
    diffKg: r1(shap.totals[i] - shap.base_kg),
    drivers: shap.sources
      .map((s, j) => ({ source: s, kg: r1(shap.values[i][j]) }))
      .filter((d) => Math.abs(d.kg) >= 0.1)
      .sort((a, b) => Math.abs(b.kg) - Math.abs(a.kg)),
  }));
  const grand = shap.source_totals.reduce((a, b) => a + b, 0) || 1;
  const sourceRanking = shap.sources
    .map((s, j) => ({ source: s, totalKg: shap.source_totals[j], sharePct: Math.round((shap.source_totals[j] / grand) * 100), kind: meta.get(s)?.kind ?? "other" }))
    .sort((a, b) => b.totalKg - a.totalKg);
  // kg per source per month for the year grid ("Everything else" = what the named sources don't cover)
  const named = shap.sources.filter((x) => sources.includes(x));
  const heat = shap.sources.map((src) => ({
    source: src,
    values: months.map((_, i) =>
      sources.includes(src)
        ? matrix[i][sources.indexOf(src)]
        : r1(shap.totals[i] - named.reduce((acc, x) => acc + matrix[i][sources.indexOf(x)], 0)),
    ),
  }));

  const peakIdx = shap.totals.indexOf(Math.max(...shap.totals));
  const peakDriver = monthInsights[peakIdx].drivers.find((d) => d.kg > 0) ?? null;
  const peak = { month: months[peakIdx], label: monthLabel(months[peakIdx]), kg: shap.totals[peakIdx], driver: peakDriver?.source ?? null, driverKg: peakDriver?.kg ?? null };

  const focusMonth = focus && months.includes(focus) ? focus : months[months.length - 1];
  const fi = months.indexOf(focusMonth);
  const fm = monthInsights[fi];

  // Estimated split of the focus month's electricity across appliances (rated or measured power × hours)
  const elecKg = sources.reduce((s, src, j) => (meta.get(src)?.kind === "electricity" ? s + matrix[fi][j] : s), 0);
  const [fy, fmo] = focusMonth.split("-").map(Number);
  const days = new Date(Date.UTC(fy, fmo, 0)).getUTCDate();
  const appl = household.appliances.filter((a) => a.type !== "SolarPV");
  const acs = appl.filter((a) => a.type === "AC");
  const est = appl.map((a) => {
    // the measured AC power (from bills) replaces the label for the household's ACs, shared by their ratings
    const kw = a.type === "AC" && calibration ? calibration.acKw * (a.powerKw / Math.max(1e-9, acs.reduce((s, x) => s + x.powerKw, 0))) * acs.length : a.powerKw;
    return { a, kwh: kw * a.avgHoursPerDay * days, measured: a.type === "AC" && !!calibration };
  });
  const estTotal = est.reduce((s, e) => s + e.kwh, 0);
  const appliances =
    elecKg > 0 && estTotal > 0
      ? est
          .map((e) => ({
            name: e.a.name ?? e.a.type,
            type: e.a.type,
            kg: r1((e.kwh / estTotal) * elecKg),
            sharePct: Math.round((e.kwh / estTotal) * 100),
            basis: `${e.measured ? "measured" : "rated"} power × ${e.a.avgHoursPerDay} h/day, scaled to your ${r1(elecKg)} kg of electricity`,
          }))
          .sort((a, b) => b.kg - a.kg)
      : [];

  const vehicleRows = sources
    .map((s, j) => ({ s, kg: matrix[fi][j], m: meta.get(s)! }))
    .filter((x) => x.m.kind === "vehicle" && x.kg > 0)
    .map((x) => {
      const v = x.m.vehicleId ? vehicles.find((vv) => vv.id === x.m.vehicleId) : undefined;
      return { name: v ? v.name ?? v.type : x.s, fuel: v?.fuel ?? "", kg: r1(x.kg), basis: "logged trips and fuel fill-ups" };
    })
    .sort((a, b) => b.kg - a.kg);

  // Facts for the summary (an LLM may reword these, but may only use these numbers)
  const up = fm.drivers.find((d) => d.kg > 0);
  const down = fm.drivers.find((d) => d.kg < 0);
  const tip = recs[0];
  const facts: Record<string, unknown> = {
    month: fm.label,
    total_kg: fm.totalKg,
    average_month_kg: shap.base_kg,
    difference_from_average_kg: Math.abs(fm.diffKg),
    direction: fm.diffKg >= 0 ? "above average" : "below average",
    biggest_increase: up ? { source: up.source, kg: up.kg } : null,
    biggest_decrease: down ? { source: down.source, kg: Math.abs(down.kg) } : null,
    peak_month: { month: peak.label, kg: peak.kg, main_reason: peak.driver, reason_kg: peak.driverKg },
    biggest_source_overall: { source: sourceRanking[0].source, share_pct: sourceRanking[0].sharePct, months: months.length },
    biggest_appliance: appliances[0] ? { name: appliances[0].name, kg: appliances[0].kg } : null,
    top_tip: tip ? { action: tip.action, saves_kg_per_month: tip.kgSaved, saves_inr_per_month: tip.inrSaved } : null,
  };

  const bullets = [
    `In ${fm.label} your home made ${fm.totalKg} kg of CO₂, ${Math.abs(fm.diffKg)} kg ${fm.diffKg >= 0 ? "more" : "less"} than your average month (${shap.base_kg} kg).`,
    up ? `${up.source} pushed it up the most: ${up.kg} kg above its usual.` : null,
    down ? `${down.source} helped the most: ${Math.abs(down.kg)} kg below its usual.` : null,
    `Your highest month was ${peak.label} at ${peak.kg} kg${peak.driver ? `, mainly ${peak.driver} (+${peak.driverKg} kg)` : ""}.`,
    `Over ${months.length} months, ${sourceRanking[0].source} made ${sourceRanking[0].sharePct}% of your CO₂.`,
    tip ? `Biggest easy win: ${tip.action.toLowerCase()} saves about ${tip.kgSaved} kg and ₹${tip.inrSaved} a month.` : null,
  ].filter((b): b is string => !!b);

  return {
    available: true,
    reason: null,
    method: shap.method,
    baseKg: shap.base_kg,
    months: monthInsights,
    sources: sourceRanking,
    heat,
    peak,
    focusMonth,
    appliances,
    vehicles: vehicleRows,
    facts,
    bullets,
  };
}
