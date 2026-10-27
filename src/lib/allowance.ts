import { GRID_KG_CO2E_PER_KWH } from "@/lib/ghg";
import { stateCode } from "@/lib/carbonId";

/**
 * A home's monthly carbon allowance: 100 kg CO₂e per person × the people in the home.
 * Green ≤ 90 % of it, amber ≤ 110 %, red above. It is a yardstick, not a legal limit.
 */
export const ALLOWANCE_PER_PERSON_KG = 100;

/**
 * State averages per person (no longer the allowance; kept for comparisons and the open data).
 * STARTING ESTIMATES, to be replaced by the admin-maintained table (PLAN-V2 §7):
 * - electricity: household (domestic) kWh per person per year ≈ state domestic sales ÷ population, rounded;
 *   all-sector per-capita figures (RBI HSIS Table 138) are 3–5× higher and are NOT used;
 * - cooking: national LPG use ≈ 17.5 kg per person per year × 2.98 kg CO₂e/kg ≈ 4.5 kg per month;
 * - private vehicles: national petrol use per person ≈ 8 kg CO₂e per month.
 * Each figure is an average over rural and urban homes; it is a yardstick, not a legal limit.
 */
// kg CO₂e per unit from the grid: CEA's 0.675 kg CO₂e plus the CH₄ and N₂O from burning the coal (src/lib/ghg.ts)
export const GRID_KG_PER_KWH = GRID_KG_CO2E_PER_KWH;
export const COOKING_KG_PER_PERSON_MONTH = 4.5;
export const TRANSPORT_KG_PER_PERSON_MONTH = 8;
export const ALLOWANCE_SOURCE = "Every person in a home is allowed 100 kg CO₂e a month, so a home's allowance is 100 kg × its people.";

/** Household electricity, kWh per person per year (estimate). */
const DOMESTIC_KWH_PER_PERSON: Record<string, { name: string; nameHi: string; kwh: number }> = {
  AP: { name: "Andhra Pradesh", nameHi: "आंध्र प्रदेश", kwh: 280 },
  AR: { name: "Arunachal Pradesh", nameHi: "अरुणाचल प्रदेश", kwh: 200 },
  AS: { name: "Assam", nameHi: "असम", kwh: 150 },
  BR: { name: "Bihar", nameHi: "बिहार", kwh: 120 },
  CG: { name: "Chhattisgarh", nameHi: "छत्तीसगढ़", kwh: 270 },
  CH: { name: "Chandigarh", nameHi: "चंडीगढ़", kwh: 900 },
  DL: { name: "Delhi", nameHi: "दिल्ली", kwh: 720 },
  GA: { name: "Goa", nameHi: "गोवा", kwh: 900 },
  GJ: { name: "Gujarat", nameHi: "गुजरात", kwh: 300 },
  HP: { name: "Himachal Pradesh", nameHi: "हिमाचल प्रदेश", kwh: 380 },
  HR: { name: "Haryana", nameHi: "हरियाणा", kwh: 420 },
  JH: { name: "Jharkhand", nameHi: "झारखंड", kwh: 180 },
  JK: { name: "Jammu and Kashmir", nameHi: "जम्मू और कश्मीर", kwh: 450 },
  KA: { name: "Karnataka", nameHi: "कर्नाटक", kwh: 230 },
  KL: { name: "Kerala", nameHi: "केरल", kwh: 340 },
  MH: { name: "Maharashtra", nameHi: "महाराष्ट्र", kwh: 290 },
  MP: { name: "Madhya Pradesh", nameHi: "मध्य प्रदेश", kwh: 190 },
  OD: { name: "Odisha", nameHi: "ओडिशा", kwh: 230 },
  PB: { name: "Punjab", nameHi: "पंजाब", kwh: 540 },
  PY: { name: "Puducherry", nameHi: "पुदुच्चेरी", kwh: 600 },
  RJ: { name: "Rajasthan", nameHi: "राजस्थान", kwh: 230 },
  TN: { name: "Tamil Nadu", nameHi: "तमिलनाडु", kwh: 450 },
  TS: { name: "Telangana", nameHi: "तेलंगाना", kwh: 340 },
  UK: { name: "Uttarakhand", nameHi: "उत्तराखंड", kwh: 300 },
  UP: { name: "Uttar Pradesh", nameHi: "उत्तर प्रदेश", kwh: 235 },
  WB: { name: "West Bengal", nameHi: "पश्चिम बंगाल", kwh: 190 },
};
const INDIA_KWH_PER_PERSON = 250;

export type CarbonStatus = "GREEN" | "AMBER" | "RED";

export function stateInfo(state: string) {
  const code = stateCode(state);
  const row = DOMESTIC_KWH_PER_PERSON[code];
  return { code, name: row?.name ?? state, nameHi: row?.nameHi ?? state, kwh: row?.kwh ?? INDIA_KWH_PER_PERSON, known: !!row };
}

/** kg CO₂e per person per month for the state */
export function stateAveragePerPerson(state: string) {
  const { kwh } = stateInfo(state);
  const electricity = (kwh * GRID_KG_PER_KWH) / 12;
  return {
    electricity: round1(electricity),
    cooking: COOKING_KG_PER_PERSON_MONTH,
    transport: TRANSPORT_KG_PER_PERSON_MONTH,
    total: round1(electricity + COOKING_KG_PER_PERSON_MONTH + TRANSPORT_KG_PER_PERSON_MONTH),
  };
}

/** The same in every state; callers still pass the state. */
export function monthlyAllowance(state: string, people: number) {
  return Math.round(ALLOWANCE_PER_PERSON_KG * Math.max(1, people));
}

export function statusFor(usedKg: number, allowanceKg: number): CarbonStatus {
  const ratio = allowanceKg > 0 ? usedKg / allowanceKg : 0;
  return ratio <= 0.9 ? "GREEN" : ratio <= 1.1 ? "AMBER" : "RED";
}

export function carbonStatus(state: string, people: number, usedKg: number) {
  const allowanceKg = monthlyAllowance(state, people);
  const ratio = allowanceKg > 0 ? usedKg / allowanceKg : 0;
  return { allowanceKg, ratio: Math.round(ratio * 100) / 100, status: statusFor(usedKg, allowanceKg), state: stateInfo(state) };
}

export const STATUS_WORDS: Record<CarbonStatus, { en: string; hi: string; tone: string }> = {
  GREEN: { en: "Green · within your allowance", hi: "हरा · आपकी सीमा के अंदर", tone: "success" },
  AMBER: { en: "Amber · close to your allowance", hi: "पीला · आपकी सीमा के पास", tone: "warning" },
  RED: { en: "Red · over your allowance", hi: "लाल · आपकी सीमा से ज़्यादा", tone: "critical" },
};

/** Everyday comparisons so a kg number means something */
export const RUPEES_PER_KWH = 7;
export function kgToRupees(kg: number) {
  return Math.round((kg / GRID_KG_PER_KWH) * RUPEES_PER_KWH);
}
/** days of running a 1.5-ton AC for 8 hours (≈ 1.5 kW × 8 h × grid factor ≈ 8 kg) */
export function kgToAcDays(kg: number) {
  return Math.max(0, Math.round(kg / (1.5 * 8 * GRID_KG_PER_KWH)));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
