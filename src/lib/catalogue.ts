import { z } from "zod";
import { APPLIANCE_TYPES, FUELS, REFRIGERANTS } from "@/lib/assets";
import { GRID_KG_PER_KWH, RUPEES_PER_KWH } from "@/lib/allowance";

/*
 * A shop's product catalogue, uploaded as a CSV (one row per product) with optional photos. At the counter the shop
 * picks a product instead of typing the label, so the home gets exact BEE figures, and the customer sees what the
 * product will cost to run and the carbon it adds before paying.
 */

export const CSV_COLUMNS = [
  "sku",
  "kind",
  "type",
  "brand",
  "model",
  "title",
  "description",
  "price_inr",
  "stars",
  "inverter",
  "capacity_ton",
  "rated_power_w",
  "annual_kwh",
  "label_year",
  "refrigerant",
  "fuel",
  "km_per_unit",
  "battery_kwh",
  "model_year",
  "warranty_years",
  "image",
] as const;

const values = <T extends readonly (readonly [string, string])[]>(xs: T) => xs.map(([v]) => v) as [T[number][0], ...T[number][0][]];
const optNum = (max: number) => z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().min(0).max(max).nullable());
const optInt = (min: number, max: number) => z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().min(min).max(max).nullable());
const optStr = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

export const CatalogueRowSchema = z
  .object({
    sku: z.string().trim().min(1, "sku is empty").max(40).regex(/^[A-Za-z0-9._/-]+$/, "sku: letters, digits, . _ / - only"),
    kind: z.preprocess((v) => String(v ?? "").trim().toUpperCase(), z.enum(["APPLIANCE", "VEHICLE"], { message: "kind must be APPLIANCE or VEHICLE" })),
    type: z.string().trim().min(1, "type is empty").max(30),
    brand: z.string().trim().min(1, "brand is empty").max(40),
    model: z.string().trim().min(1, "model is empty").max(60),
    title: optStr(120),
    description: optStr(600),
    price_inr: z.preprocess((v) => Number(String(v ?? "").replace(/[₹,\s]/g, "")), z.number({ message: "price_inr must be a number" }).int().min(1, "price_inr is missing").max(50_00_00_000)),
    stars: optInt(0, 5),
    inverter: z.preprocess((v) => /^(1|y|yes|true)$/i.test(String(v ?? "").trim()), z.boolean()),
    capacity_ton: optNum(5),
    rated_power_w: optInt(1, 20000),
    annual_kwh: optNum(20000),
    label_year: optInt(2006, 2100),
    refrigerant: optStr(10),
    fuel: optStr(10),
    km_per_unit: optNum(300),
    battery_kwh: optNum(200),
    model_year: optInt(1980, 2100),
    warranty_years: optInt(0, 20),
    image: optStr(120),
  })
  .superRefine((r, ctx) => {
    if (r.kind === "APPLIANCE") {
      if (!values(APPLIANCE_TYPES).includes(r.type as never)) ctx.addIssue({ code: "custom", message: `type must be one of ${values(APPLIANCE_TYPES).join(", ")}` });
      if (r.rated_power_w === null) ctx.addIssue({ code: "custom", message: "rated_power_w (from the star label) is needed for appliances" });
      if (r.stars === null) ctx.addIssue({ code: "custom", message: "stars is needed for appliances (0 if no label)" });
      if (r.refrigerant && !(REFRIGERANTS as readonly string[]).includes(r.refrigerant)) ctx.addIssue({ code: "custom", message: `refrigerant must be one of ${REFRIGERANTS.join(", ")}` });
    } else {
      if (!["Car", "SUV", "TwoWheeler", "ThreeWheeler"].includes(r.type)) ctx.addIssue({ code: "custom", message: "type must be Car, SUV, TwoWheeler or ThreeWheeler" });
      if (!r.fuel || !(FUELS as readonly string[]).includes(r.fuel)) ctx.addIssue({ code: "custom", message: `fuel must be one of ${FUELS.join(", ")}` });
      if (r.model_year === null) ctx.addIssue({ code: "custom", message: "model_year is needed for vehicles" });
    }
  });

export type CatalogueRow = z.infer<typeof CatalogueRowSchema>;

/** RFC 4180 CSV: commas, quoted fields with "" escapes and line breaks inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Rows as objects keyed by the header, with 1-based CSV line numbers for error messages. */
export function csvRecords(text: string): { line: number; record: Record<string, string> }[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((r, i) => ({ line: i + 2, record: Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? "").trim()])) }));
}

const cell = (v: string | number | boolean | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(rows: (string | number | boolean | null | undefined)[][]) {
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

const TEMPLATE_ROWS = [
  ["AC-15-5S-INV", "APPLIANCE", "AC", "Coolwell", "CW-18INV-5S", "Coolwell 1.5 t 5-star inverter split AC", "Copper coil, R32 gas, 4-way swing", 41990, 5, "yes", 1.5, 1450, 820, 2026, "R32", "", "", "", "", 5, "coolwell-18inv.jpg"],
  ["FR-260-3S", "APPLIANCE", "Refrigerator", "Frostline", "FL-260-3S", "Frostline 260 L 3-star frost-free fridge", "", 24990, 3, "no", "", 120, 255, 2026, "", "", "", "", "", 2, "frostline-260.jpg"],
  ["EV-SCOOT-30", "VEHICLE", "TwoWheeler", "Demo Motors", "Volt 3.0", "Volt 3.0 electric scooter", "3 kWh battery, 110 km certified range", 109000, "", "no", "", "", "", "", "", "Electric", 36, 3, 2026, 3, "volt-30.jpg"],
];

/** A ready-to-fill template with example rows (made-up brands), only for what the shop sells. */
export function templateCsv(sells: string = "BOTH") {
  const rows = TEMPLATE_ROWS.filter((r) => sells === "BOTH" || (sells === "VEHICLES" ? r[1] === "VEHICLE" : r[1] === "APPLIANCE"));
  return toCsv([[...CSV_COLUMNS], ...rows]);
}
export const TEMPLATE_CSV = templateCsv("BOTH");

export type CatalogueFacts = {
  yearlyKwh: number | null;
  yearlyRupees: number | null;
  yearlyKg: number | null;
  efficiency: "BEST" | "GOOD" | "POOR" | null;
  benefitInr: number | null;
  benefitNote: string | null;
};

const FUEL_KG: Record<string, number> = { Petrol: 2.31, Diesel: 2.68, CNG: 2.75, Hybrid: 2.31 };
const FUEL_RUPEES: Record<string, number> = { Petrol: 95, Diesel: 88, CNG: 90, Hybrid: 95 };
const DAILY_HOURS: Record<string, number> = { AC: 6, Refrigerator: 24 * 0.4, WaterHeater: 0.5, WashingMachine: 0.6, Fan: 10, Cooler: 8, Cooktop: 1.5, TV: 4, Computer: 4 };

/**
 * What a product means for a home over a year, shown at the counter and in the catalogue: running cost, carbon,
 * how efficient it is, and any government benefit that applies. Plain estimates, labelled as such where shown.
 */
export function catalogueFacts(i: {
  kind: string;
  type: string;
  stars: number | null;
  inverter: boolean;
  ratedPowerW: number | null;
  annualKwh: number | null;
  fuel: string | null;
  kmPerUnit: number | null;
  batteryKwh: number | null;
}): CatalogueFacts {
  if (i.kind === "APPLIANCE") {
    const kwh = i.annualKwh ?? (i.ratedPowerW ? (i.ratedPowerW / 1000) * (DAILY_HOURS[i.type] ?? 3) * (i.type === "AC" ? 240 : 365) : null);
    // 0 stars means "no BEE label" (e.g. induction cooktops aren't rated), not "inefficient"
    const eff = i.stars === null || i.stars === 0 ? null : i.stars >= 5 || (i.inverter && i.stars >= 4) ? "BEST" : i.stars >= 3 ? "GOOD" : "POOR";
    return {
      yearlyKwh: kwh ? Math.round(kwh) : null,
      yearlyRupees: kwh ? Math.round(kwh * RUPEES_PER_KWH) : null,
      yearlyKg: kwh ? Math.round(kwh * GRID_KG_PER_KWH) : null,
      efficiency: eff,
      benefitInr: null,
      benefitNote:
        i.type === "AC" && eff === "POOR"
          ? "Low-star ACs cost more to run every summer; suggest a 5-star inverter."
          : i.type === "Cooktop"
            ? "Cooking on induction instead of an LPG flame avoids about 3 kg of CO₂ for every kg of gas not burned."
            : null,
    };
  }
  // vehicles: a year at 7,200 km (600 a month)
  const km = 7200;
  if (i.fuel === "Electric") {
    const kwh = i.kmPerUnit ? km / i.kmPerUnit : null;
    const benefit = i.type === "TwoWheeler" && i.batteryKwh ? Math.min(5000, Math.round(i.batteryKwh * 2500)) : null;
    return {
      yearlyKwh: kwh ? Math.round(kwh) : null,
      yearlyRupees: kwh ? Math.round(kwh * RUPEES_PER_KWH) : null,
      yearlyKg: kwh ? Math.round(kwh * GRID_KG_PER_KWH) : null,
      efficiency: "BEST",
      benefitInr: benefit,
      benefitNote: benefit ? "PM E-DRIVE: up to ₹5,000 off at the dealer for approved e-two-wheelers (till 31 Mar 2028)." : null,
    };
  }
  const units = i.kmPerUnit ? km / i.kmPerUnit : null;
  return {
    yearlyKwh: null,
    yearlyRupees: units && i.fuel ? Math.round(units * (FUEL_RUPEES[i.fuel] ?? 95)) : null,
    yearlyKg: units && i.fuel ? Math.round(units * (FUEL_KG[i.fuel] ?? 2.31)) : null,
    efficiency: i.kmPerUnit ? (i.kmPerUnit >= 40 || (i.type !== "TwoWheeler" && i.kmPerUnit >= 20) ? "GOOD" : "POOR") : null,
    benefitInr: null,
    benefitNote: "Scrapping an old vehicle at a registered centre can cut this one's road tax by up to 25%.",
  };
}
