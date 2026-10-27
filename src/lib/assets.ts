import { z } from "zod";

// What a household can own, in plain words for the forms; values are what the database stores.
export const APPLIANCE_TYPES = [
  ["AC", "Air conditioner"],
  ["Refrigerator", "Fridge"],
  ["WaterHeater", "Geyser / water heater"],
  ["WashingMachine", "Washing machine"],
  ["Fan", "Ceiling fan"],
  ["Cooler", "Air cooler"],
  ["Cooktop", "Induction cooktop"],
  ["TV", "Television"],
  ["Computer", "Computer"],
  ["SolarPV", "Rooftop solar"],
  ["Other", "Other"],
] as const;

export const RATINGS = [
  ["5_STAR_INVERTER", "5-star inverter"],
  ["5_STAR", "5-star"],
  ["4_STAR", "4-star"],
  ["3_STAR", "3-star"],
  ["2_STAR", "2-star"],
  ["1_STAR", "1-star"],
  ["INVERTER", "Inverter (no star)"],
  ["NON_INVERTER", "Non-inverter"],
  ["UNRATED", "No label"],
] as const;

export const VEHICLE_TYPES = [
  ["Car", "Car"],
  ["SUV", "SUV"],
  ["TwoWheeler", "Scooter / bike"],
  ["ThreeWheeler", "Auto"],
  ["PublicTransit", "Public transport pass"],
] as const;

export const FUELS = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] as const;

const values = <T extends readonly (readonly [string, string])[]>(list: T) =>
  list.map(([v]) => v) as unknown as [T[number][0], ...T[number][0][]];

export const ApplianceSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(60),
  type: z.enum(values(APPLIANCE_TYPES)),
  rating: z.enum(values(RATINGS)).default("3_STAR"),
  powerKw: z.number().positive("Power must be above 0").max(20),
  avgHoursPerDay: z.number().min(0).max(24).default(4.0),
});

export const VehicleSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(60),
  type: z.enum(values(VEHICLE_TYPES)).default("Car"),
  fuel: z.enum(FUELS).default("Petrol"),
  kmPerUnit: z.number().positive().max(200).default(14.0), // km per litre (per kg CNG, per kWh EV)
  monthlyKm: z.number().min(0).max(20000).default(300.0),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1).nullish(),
});

export const labelOf = (list: readonly (readonly [string, string])[], v: string) => list.find(([k]) => k === v)?.[1] ?? v;

// Typical real-world mileage in India, used only to pre-fill forms (people can type their own)
export const TYPICAL_MILEAGE: Record<string, Record<string, number>> = {
  Car: { Petrol: 14, Diesel: 17, CNG: 24, Hybrid: 20, Electric: 7 },
  SUV: { Petrol: 11, Diesel: 13, CNG: 18, Hybrid: 16, Electric: 5.5 },
  TwoWheeler: { Petrol: 45, Diesel: 45, CNG: 45, Hybrid: 45, Electric: 30 },
  ThreeWheeler: { Petrol: 25, Diesel: 28, CNG: 30, Hybrid: 28, Electric: 12 },
  PublicTransit: { Petrol: 14, Diesel: 14, CNG: 14, Hybrid: 14, Electric: 14 },
};
/** Mileage drops as engines age: ~1% a year after the fifth year (rule of thumb; edit if you know yours). */
export function suggestedMileage(type: string, fuel: string, year: number | null) {
  const base = TYPICAL_MILEAGE[type]?.[fuel] ?? 14;
  const age = year ? Math.max(0, new Date().getFullYear() - year) : 0;
  return Math.round(base * Math.pow(0.99, Math.max(0, age - 5)) * 10) / 10;
}

/*
 * Registered at a shop counter (merchant.service.ts). The shop reads the specs off the BEE star label and the
 * invoice; the household sets how much it is used. BEE re-bases its star bands every few years (stricter from
 * 2026), so the label's year is kept next to its stars.
 */
export const REFRIGERANTS = ["R32", "R410A", "R290", "R22"] as const;
export const AC_CAPACITIES = [0.75, 1, 1.5, 2, 2.5] as const;
export const MERCHANT_VEHICLE_TYPES = VEHICLE_TYPES.filter(([v]) => v !== "PublicTransit");

/** Hours a day to start from until the household sets its own (a fridge's compressor runs about 40% of the time). */
export const DEFAULT_HOURS: Record<string, number> = {
  AC: 6, Refrigerator: 10, WaterHeater: 1, WashingMachine: 1, Fan: 8, Cooler: 6, Cooktop: 1, TV: 4, Computer: 4, SolarPV: 5, Other: 4,
};

/** Stars and inverter off the label → the rating values the rest of the app uses. */
export function ratingFrom(stars: number, inverter: boolean, type: string): (typeof RATINGS)[number][0] {
  if (stars === 5 && inverter) return "5_STAR_INVERTER";
  if (stars >= 1) return `${stars}_STAR` as (typeof RATINGS)[number][0];
  if (type === "AC") return inverter ? "INVERTER" : "NON_INVERTER";
  return "UNRATED";
}

const nextYear = () => new Date().getFullYear() + 1;
const purchasedOn = z.coerce
  .date()
  .refine((d) => d.getTime() <= Date.now() + 86_400_000, "The purchase date can't be in the future")
  .optional();
const invoiceRef = z.string().trim().max(40).optional();

export const MerchantApplianceSchema = z.object({
  type: z.enum(values(APPLIANCE_TYPES)).default("AC"),
  brand: z.string().trim().min(1, "Enter the brand").max(40),
  model: z.string().trim().min(1, "Enter the model number").max(60),
  stars: z.number().int().min(0).max(5), // 0 = no star label
  inverter: z.boolean().default(false),
  labelYear: z.number().int().min(2006).max(nextYear()).nullish(), // BEE labels began in 2006
  ratedPowerW: z.number().positive("Enter the rated power from the label").max(20000),
  capacityTon: z.number().positive().max(5).nullish(),
  annualKwh: z.number().positive().max(20000).nullish(),
  refrigerant: z.enum(REFRIGERANTS).nullish(),
  serialNo: z.string().trim().min(3, "Enter the serial number").max(60),
  purchasedOn,
  invoiceRef,
});

export const MerchantVehicleSchema = z.object({
  type: z.enum(["Car", "SUV", "TwoWheeler", "ThreeWheeler"]).default("Car"),
  fuel: z.enum(FUELS),
  make: z.string().trim().min(1, "Enter the make").max(40),
  model: z.string().trim().min(1, "Enter the model").max(60),
  variant: z.string().trim().max(60).optional(),
  year: z.number().int().min(1980).max(nextYear()),
  kmPerUnit: z.number().positive().max(200).nullish(), // certified (ARAI) mileage; blank → typical for the type
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{11,17}$/, "The chassis number (VIN) is 11–17 letters and digits, without I, O or Q"),
  registrationNo: z.string().trim().toUpperCase().max(15).nullish(),
  purchasedOn,
  invoiceRef,
});

export const MerchantSaleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("APPLIANCE"), ticket: z.string().min(16).max(128), item: MerchantApplianceSchema }),
  z.object({ kind: z.literal("VEHICLE"), ticket: z.string().min(16).max(128), item: MerchantVehicleSchema }),
]);

// What an owner may still change on an item a shop registered: how it's used, never the specs the shop entered
export const OwnerApplianceUsageSchema = ApplianceSchema.pick({ name: true, avgHoursPerDay: true }).partial();
export const OwnerVehicleUsageSchema = VehicleSchema.pick({ name: true, monthlyKm: true }).partial();

/** Shown when a household tries to add an item itself. */
export const ITEMS_BY_SHOPS =
  "Items are added by the shop when you buy them: show your Carbon Card at the counter. For things you already own, any Carbon Wallet shop can register them from your card.";
export const REMOVE_BY_REQUEST =
  "Items can't be deleted from here. Ask for removal with a photo and a short note; our team checks it and removes it.";
