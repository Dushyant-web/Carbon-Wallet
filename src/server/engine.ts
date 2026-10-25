import type { BillExtraction } from "@/lib/bills";
import type { AnchorResult, CalibrationResult, DecompositionResult, StatementBundle, StatementStatus } from "@/lib/engine";

// Server-side client for the FastAPI engine. Bill extraction is server-to-server only (engine key).
const BASE = process.env.PY_API_URL ?? "http://127.0.0.1:8001";

export class EngineError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "EngineError";
  }
}

export async function engineExtractBill(bytes: Buffer, allowAi: boolean): Promise<BillExtraction> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/bills/extract?allow_ai=${allowAi ? "true" : "false"}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "x-engine-key": process.env.ENGINE_API_KEY ?? "" },
      body: new Uint8Array(bytes),
      cache: "no-store",
    });
  } catch {
    throw new EngineError("The bill reader is offline. Start the engine (backend) and try again.", 503);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 415 || res.status === 413 || res.status === 400) {
    throw new EngineError(body.detail ?? "That file couldn't be read as a bill.", res.status);
  }
  if (res.status === 401 || res.status === 503) {
    throw new EngineError("The bill reader isn't configured (engine key).", 502);
  }
  if (!res.ok) throw new EngineError("The bill reader failed on this file.", 502);
  return body as BillExtraction;
}

export type CalibrationInput = { period_start: string; period_end: string; kwh: number; ac_hours: number };

async function postJson<T>(path: string, body: unknown, withKey = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(withKey ? { "x-engine-key": process.env.ENGINE_API_KEY ?? "" } : {}) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new EngineError("The engine is offline.", 503);
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new EngineError(typeof out.detail === "string" ? out.detail : `Engine error on ${path}`, res.status);
  return out as T;
}

export function engineCalibrate(bills: CalibrationInput[]) {
  return postJson<CalibrationResult>("/calibration", { bills });
}

export type CddPeriod = {
  start: string;
  end: string;
  days: number;
  days_with_data: number;
  cdd: number;
  mean_temp_c: number;
  max_daily_mean_c: number;
};
export type CddResult = {
  location: { name: string; admin1: string | null; lat: number; lon: number };
  base_c: number;
  source: string;
  periods: CddPeriod[];
};

/** Real cooling degree days for each period at the household's city (Open-Meteo, cached by the engine). */
export function engineCdd(city: string, state: string, periods: { start: string; end: string }[]) {
  return postJson<CddResult>("/weather/cdd", { city, state, periods }, true);
}

export type HeatDay = { date: string; tmax_c: number; normal_c: number | null; departure_c: number | null; why: string };
export type HeatDaysResult = {
  location: CddResult["location"];
  rule: string;
  source: string;
  periods: { start: string; end: string; zone: "plains" | "coastal" | "hills"; days_checked: number; count: number; days: HeatDay[] }[];
};

/** IMD heatwave days in each period at the household's city (Open-Meteo daily max, cached by the engine). */
export function engineHeatDays(city: string, state: string, periods: { start: string; end: string }[]) {
  return postJson<HeatDaysResult>("/weather/heat-days", { city, state, periods }, true);
}

// --- Statements: issuing, sealing and reading need the engine key, so only this server does them --------
async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, { headers: { "x-engine-key": process.env.ENGINE_API_KEY ?? "" }, cache: "no-store" });
  } catch {
    throw new EngineError("The engine is offline.", 503);
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new EngineError(typeof out.detail === "string" ? out.detail : `Engine error on ${path}`, res.status);
  return out as T;
}

export function engineIssueStatement(body: {
  household_ref: string;
  period: string;
  total_kg: number;
  by_category: Record<string, number>;
  verified_reductions_kg: number;
}) {
  return postJson<StatementBundle>("/statements", body, true);
}
export function engineAnchor() {
  return postJson<AnchorResult>("/anchors", {}, true);
}
export function engineStatementStatus(householdRef: string) {
  return getJson<StatementStatus[]>(`/statements?household_ref=${encodeURIComponent(householdRef)}`);
}
/** Erase a household's statements and their salts (its on-chain roots can then never be linked to it). */
export function engineShredStatements(householdRef: string) {
  return postJson<{ deleted: number }>("/statements/shred", { household_ref: householdRef }, true);
}
export function engineGetStatement(id: string) {
  return getJson<StatementBundle>(`/statements/${encodeURIComponent(id)}`);
}

export type AcPeriodInput = { cdd: number; ac_hours: number; kw: number };
export function engineDecompose(before: AcPeriodInput, after: AcPeriodInput) {
  return postJson<DecompositionResult>("/decomposition", { before, after });
}

export type ShapleyResult = {
  months: string[];
  sources: string[];
  base_kg: number;
  values: number[][];
  totals: number[];
  source_totals: number[];
  method: string;
};

/** Shapley values (SHAP) of each source for each month, relative to the household's average month. */
export function engineShapley(months: string[], sources: string[], matrix: number[][]) {
  return postJson<ShapleyResult>("/insights/shapley", { months, sources, matrix });
}

export type Narrative = { bullets: string[]; model: string | null; reason: string | null };

/** Plain-English bullets written by an LLM from our numbers; bullets with invented numbers are dropped. */
export function engineNarrate(facts: Record<string, unknown>, bullets = 4) {
  return postJson<Narrative>("/insights/narrate", { facts, bullets }, true);
}

export type FuelReading = {
  fuel: "Petrol" | "Diesel" | "CNG" | null;
  quantity: number | null;
  amount_inr: number | null;
  rate: number | null;
  date: string | null;
  confidence: "high" | "medium" | "low";
  source: "ocr" | "ai";
  ai_used: boolean;
  needs_ai: boolean;
  warnings: string[];
};

/** Reads litres, rupees and rate from a pump-display or receipt photo (engine key, server-to-server). */
export async function engineExtractFuel(bytes: Buffer, allowAi: boolean): Promise<FuelReading> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/fuel/extract?allow_ai=${allowAi ? "true" : "false"}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "x-engine-key": process.env.ENGINE_API_KEY ?? "" },
      body: new Uint8Array(bytes),
      cache: "no-store",
    });
  } catch {
    throw new EngineError("The photo reader is offline. Start the engine (backend) and try again.", 503);
  }
  const body = await res.json().catch(() => ({}));
  if ([400, 413, 415].includes(res.status)) throw new EngineError(body.detail ?? "That photo couldn't be read.", res.status);
  if (!res.ok) throw new EngineError("The photo reader failed on this image.", 502);
  return body as FuelReading;
}
