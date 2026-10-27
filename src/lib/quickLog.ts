import type { Category } from "@/types";
import { airport } from "./airports";

/*
 * One-tap logging: each template turns a couple of everyday answers ("2 cylinders", "Delhi → Mumbai, return")
 * into one activity. The kg itself is always computed on the server from the factor registry, so nothing
 * here can drift from what gets recorded.
 */

/** DEFRA: add 8% to the great-circle distance for routing, holding patterns and delays. */
export const FLIGHT_UPLIFT = 1.08;

export const LPG_CYLINDERS = [
  { kg: 14.2, label: "Home (14.2 kg)" },
  { kg: 5, label: "Small (5 kg)" },
  { kg: 19, label: "Commercial (19 kg)" },
] as const;

export const REFRIGERANTS = [
  { id: "R32", type: "refrigerant_r32", label: "R-32 (most new ACs)" },
  { id: "R410A", type: "refrigerant_r410a", label: "R-410A" },
  { id: "R22", type: "refrigerant_r22", label: "R-22 (older ACs)" },
] as const;
export type RefrigerantId = (typeof REFRIGERANTS)[number]["id"];

export type QuickVehicle = { name?: string | null; type: string; fuel: string };

export type QuickLog =
  | { kind: "lpg"; cylinders: number; cylinderKg: number }
  | { kind: "ac_gas"; gas: RefrigerantId; kg: number }
  | { kind: "flight"; from: string; to: string; cabin: "economy" | "business"; roundTrip: boolean }
  | { kind: "transit"; mode: "metro" | "bus" | "train"; km: number }
  | { kind: "drive"; vehicle: QuickVehicle; km: number };

export type ActivityPayload = { category: Category; type: string; quantity: number; unit: string; notes: string };

const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

export function greatCircleKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Flown km for a trip, including the uplift and both legs of a return. Null if the airports aren't known. */
export function flightKm(from: string, to: string, roundTrip: boolean): number | null {
  const a = airport(from);
  const b = airport(to);
  if (!a || !b || a.code === b.code) return null;
  return Math.round(greatCircleKm(a, b) * FLIGHT_UPLIFT * (roundTrip ? 2 : 1));
}

/** The factor a vehicle's km use, or null where there's no sourced factor (e-scooters, autos, passes). */
export function vehicleTripType(v: QuickVehicle): string | null {
  if (v.type === "TwoWheeler") return v.fuel === "Petrol" ? "two_wheeler_petrol" : null;
  if (v.type !== "Car" && v.type !== "SUV") return null;
  switch (v.fuel) {
    case "Petrol":
    case "Hybrid": // same rule as fuel fill-ups (fuel.service.ts): hybrids use the petrol factor
      return "petrol_car";
    case "Diesel":
      return "diesel_car";
    case "CNG":
      return "cng_car";
    case "Electric":
      return "electric_vehicle";
    default:
      return null;
  }
}

const TRANSIT = {
  metro: { type: "metro_transit", label: "Metro" },
  bus: { type: "city_bus", label: "Bus" },
  train: { type: "intercity_train", label: "Train" },
} as const;

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

/** The activity a quick log records, or null if the answers aren't complete yet. */
export function toActivity(q: QuickLog): ActivityPayload | null {
  switch (q.kind) {
    case "lpg": {
      if (!(q.cylinders > 0) || !(q.cylinderKg > 0)) return null;
      const kg = Number((q.cylinders * q.cylinderKg).toFixed(2));
      return { category: "Cooking", type: "lpg_cooking", quantity: kg, unit: "kg", notes: `${fmt(q.cylinders)} × ${fmt(q.cylinderKg)} kg LPG cylinder` };
    }
    case "ac_gas": {
      const gas = REFRIGERANTS.find((r) => r.id === q.gas);
      if (!gas || !(q.kg > 0) || q.kg > 10) return null;
      return { category: "Refrigerant", type: gas.type, quantity: q.kg, unit: "kg", notes: `AC gas refill: ${fmt(q.kg)} kg ${gas.label.split(" ")[0]}` };
    }
    case "flight": {
      const km = flightKm(q.from, q.to, q.roundTrip);
      if (km === null) return null;
      const a = airport(q.from)!;
      const b = airport(q.to)!;
      return {
        category: "Travel",
        type: q.cabin === "business" ? "flight_domestic_business" : "flight_domestic_economy",
        quantity: km,
        unit: "km",
        notes: `Flight ${a.city} → ${b.city}${q.roundTrip ? " and back" : ""}, ${q.cabin} (${fmt(km)} km)`,
      };
    }
    case "transit": {
      if (!(q.km > 0)) return null;
      const t = TRANSIT[q.mode];
      return { category: "Travel", type: t.type, quantity: q.km, unit: "km", notes: `${t.label}, ${fmt(q.km)} km` };
    }
    case "drive": {
      const type = vehicleTripType(q.vehicle);
      if (!type || !(q.km > 0)) return null;
      return { category: "Transport", type, quantity: q.km, unit: "km", notes: `${q.vehicle.name || q.vehicle.type}, ${fmt(q.km)} km` };
    }
  }
}
