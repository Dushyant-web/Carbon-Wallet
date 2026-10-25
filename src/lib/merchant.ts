import { z } from "zod";

// What a registered shop sells decides what it may register to a household at the counter.
export const SELLS = [
  ["APPLIANCES", "Appliances (ACs, fridges, geysers…)"],
  ["VEHICLES", "Vehicles (cars, scooters, bikes)"],
  ["BOTH", "Both"],
] as const;
export type Sells = (typeof SELLS)[number][0];

export const MERCHANT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  SUSPENDED: "Suspended",
};

// GSTIN: 2-digit state code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", check character
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const MerchantProfileSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the shop's name").max(80),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .max(15)
    .refine((v) => v === "" || GSTIN.test(v), "That doesn't look like a GSTIN (15 characters, e.g. 09AAACH7409R1ZZ)")
    .transform((v) => v || null)
    .nullish(),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(60),
  sells: z.enum(["APPLIANCES", "VEHICLES", "BOTH"]),
});
export type MerchantProfile = z.infer<typeof MerchantProfileSchema>;

export const sellsAppliances = (sells: string) => sells === "APPLIANCES" || sells === "BOTH";
export const sellsVehicles = (sells: string) => sells === "VEHICLES" || sells === "BOTH";
