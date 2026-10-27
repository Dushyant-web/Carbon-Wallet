import { db } from "@/server/db";
import { EngineError, engineMlPredict, engineMlStatus, engineMlTrain, engineMlTrainInBackground, type MlForecast, type MlHome } from "@/server/engine";

/*
 * Next month's CO₂ for a home, from the engine's machine-learned model (backend/app/ml/forecast.py).
 * The website sends each home's monthly totals plus a few facts (people, AC power, city for the weather);
 * no names, emails or bills leave this server. The model is retrained nightly (job "ml") or from the admin page.
 */

const FIRST_MONTH = "2024-01";
const MIN_MONTHS = 2; // a forecast needs at least last month; training uses rows with more history
const CACHE_MS = 6 * 3600_000;

async function homesForModel(ids?: string[]): Promise<MlHome[]> {
  const rows = await db.household.findMany({
    where: { status: "ACTIVE", ...(ids ? { id: { in: ids } } : {}) },
    select: {
      id: true,
      city: true,
      state: true,
      size: true,
      appliances: { select: { type: true, powerKw: true } },
      monthlySummaries: { where: { month: { gte: FIRST_MONTH } }, select: { month: true, totalKg: true }, orderBy: { month: "asc" } },
    },
  });
  return rows
    .filter((h) => h.monthlySummaries.length >= MIN_MONTHS)
    .map((h) => {
      const acs = h.appliances.filter((a) => a.type === "AC");
      return {
        id: h.id,
        city: h.city,
        state: h.state,
        people: Math.max(1, h.size),
        ac_kw: Math.round(acs.reduce((s, a) => s + a.powerKw, 0) * 100) / 100,
        ac_count: acs.length,
        appliance_kw: Math.round(h.appliances.filter((a) => a.type !== "AC" && a.type !== "SolarPV").reduce((s, a) => s + a.powerKw, 0) * 100) / 100,
        months: h.monthlySummaries.map((m) => ({ month: m.month, kg: Math.round(m.totalKg * 10) / 10 })),
      };
    });
}

/** Retrain on every home with enough history and wait for the result (scripts, tests). */
export async function trainForecast() {
  const homes = await homesForModel();
  cache.clear();
  return engineMlTrain(homes);
}

/** Retrain without waiting: the engine trains in the background (the nightly job and the admin button). */
export async function startForecastTraining() {
  const homes = await homesForModel();
  cache.clear();
  return engineMlTrainInBackground(homes);
}

export async function forecastStatus() {
  const [engine, homes] = await Promise.all([engineMlStatus().catch((e: Error) => ({ trained: false, info: null, error: e.message })), homesForModel()]);
  const demo = await db.household.count({ where: { status: "ACTIVE", demo: true } });
  return {
    ...engine,
    data: {
      homesWithHistory: homes.length,
      homeMonths: homes.reduce((s, h) => s + h.months.length, 0),
      demoHomes: demo,
      realHomes: (await db.household.count({ where: { status: "ACTIVE" } })) - demo,
    },
  };
}

const cache = new Map<string, { at: number; key: string; value: ForecastView }>();

export type ForecastView = (MlForecast & { weather: string; model: { trainedAt: string; beatsBaseline: boolean; maeKg: number | null; baselineMaeKg: number | null } }) | null;

/** This home's forecast, or null when it has too little history. Trains the model first if there isn't one. */
export async function forecastFor(householdId: string): Promise<ForecastView> {
  const [home] = await homesForModel([householdId]);
  if (!home) return null;
  const key = `${home.months[home.months.length - 1]?.month}:${home.months.length}`;
  const hit = cache.get(householdId);
  if (hit && hit.key === key && Date.now() - hit.at < CACHE_MS) return hit.value;

  let res;
  try {
    res = await engineMlPredict([home]);
  } catch (err) {
    if (!(err instanceof EngineError) || err.status !== 409) throw err;
    await startForecastTraining(); // first use: no model yet; it will be ready in under a minute
    throw new EngineError("The forecast is being prepared. Check back in a minute.", 503);
  }
  const f = res.forecasts[0];
  const value: ForecastView = f
    ? {
        ...f,
        weather: res.weather,
        model: {
          trainedAt: res.model.trained_at,
          beatsBaseline: res.model.beats_baseline,
          maeKg: res.model.held_out?.model.mae_kg ?? null,
          baselineMaeKg: res.model.held_out?.same_as_last_month.mae_kg ?? null,
        },
      }
    : null;
  cache.set(householdId, { at: Date.now(), key, value });
  return value;
}
