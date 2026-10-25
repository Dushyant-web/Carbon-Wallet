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
