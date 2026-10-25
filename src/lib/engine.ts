// Typed client for the FastAPI engine (backend/), proxied by Next at /py.

export class EngineOfflineError extends Error {}

async function post<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/py/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new EngineOfflineError("engine offline");
  }
  if (res.status >= 500) throw new EngineOfflineError(`engine returned ${res.status}`);
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json.detail === "string" ? json.detail : "Request rejected");
  return json as T;
}


export type BillInput = { period_start: string; period_end: string; kwh: number; ac_hours: number };

export type CalibrationResult = {
  method: "regression" | "single_bill" | "default";
  n_bills: number;
  baseload_kwh_per_day: number;
  ac_kw: number;
  ac_kw_range: [number, number];
  at_limit?: boolean;
  latest_bill: {
    electricity_kwh: number;
    electricity_kg: number;
    ac_kwh: number;
    ac_kg: number;
    ac_kg_low: number;
    ac_kg_high: number;
    ac_share_pct: number;
    residual_kwh: number;
  };
  grid_factor: number;
  factor_set: string;
};

export type AcPeriod = { cdd: number; ac_hours: number; kw: number };

export type DecompositionResult = {
  before_kg: number;
  after_kg: number;
  total_change_kg: number;
  effects_kg: { weather: number; behaviour: number; equipment: number; grid: number };
  controllable_kg: number;
};

export type SimulationInput = {
  ac_kw: number;
  ac_hours_per_day: number;
  days?: number;
  setpoint_from_c?: number;
  setpoint_to_c?: number;
  hours_reduction_per_day?: number;
  car_km_per_trip_day?: number;
  metro_days_per_week?: number;
  tariff_inr_per_kwh?: number;
};

export type SimulationResult = {
  baseline_ac_kwh: number;
  baseline_ac_kg: number;
  ac_saved_kwh: number;
  ac_saved_kg: number;
  ac_saved_kg_low: number;
  ac_saved_kg_high: number;
  transport_saved_kg: number;
  total_saved_kg: number;
  inr_saved: number;
  annualised_kg: number;
};

export type StatementBundle = {
  id: string;
  statement: Record<string, unknown>;
  salt: string;
  leaf: string;
  proof: string[];
  batch_id: number | null;
  anchor: null | ChainInfo & { merkle_root: string; factor_set: string; anchored_at: string };
};

/** Where a batch was anchored. On the local devnet the chain fields are null and there's no explorer link. */
export type ChainInfo = {
  chain: string;
  tx_hash: string;
  chain_id?: number | null;
  contract?: string | null;
  chain_batch_id?: number | null;
  block_number?: number | null;
  explorer_url?: string | null;
};

export type StatementStatus = {
  period: string;
  anchored: boolean;
  batch_id: number | null;
  merkle_root: string | null;
  tx_hash: string | null;
  chain: string | null;
  statement_id: string;
  explorer_url: string | null;
};

export type AnchorResult = ChainInfo & {
  batch_id: number;
  merkle_root: string;
  n_statements: number;
  factor_set: string;
  factor_set_hash: string;
};

export type VerifyResult = {
  valid: boolean;
  reason: string;
  onchain?: boolean | null; // the contract's own answer, when the batch is on a public chain
  explorer_url?: string | null;
  block_number?: number | null;
  merkle_root?: string;
  chain?: string;
  tx_hash?: string;
  factor_set?: string;
  anchored_at?: string;
};

export const engine = {
  calibrate: (bills: BillInput[]) => post<CalibrationResult>("/calibration", { bills }),
  decompose: (before: AcPeriod, after: AcPeriod) =>
    post<DecompositionResult>("/decomposition", { before, after }),
  simulate: (input: SimulationInput) => post<SimulationResult>("/simulation", input),
  refrigerant: (refrigerant: string, kg_added: number) =>
    post<{ kg_co2e: number }>("/refrigerant", { refrigerant, kg_added }),
  // Locking, sealing and reading statements go through this app's server (/api/households/[id]/statements),
  // which holds the engine key. Verifying needs nothing secret, so anyone can call it directly.
  verify: (body: { statement: unknown; salt: string; proof: string[]; batch_id: number }) =>
    post<VerifyResult>("/verify", body),
};
