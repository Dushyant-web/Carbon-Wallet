import { z } from "zod";

export const CategoryEnum = z.enum([
  "Electricity",
  "Transport",
  "Travel",
  // cooking gas (LPG)
  "Cooking",
  // no longer counted (src/server/counted.ts); kept so old logs still read
  "Food",
  "Waste",
  // AC gas top-ups: a one-off, booked in the month of the refill
  "Refrigerant",
]);
export type Category = z.infer<typeof CategoryEnum>;

export const ActivitySourceEnum = z.enum([
  "MANUAL",
  "SMART_METER",
  "RECURRING",
  "BILL_IMPORT",
  "FUEL_PHOTO",
  "CHECKIN", // the weekly check-in
  "ROUTINE", // a missed week, estimated from the latest check-in
]);
export type ActivitySource = z.infer<typeof ActivitySourceEnum>;

export const RoleEnum = z.enum(["OWNER", "MEMBER", "VIEWER"]); // Owner · Family · View only
export type Role = z.infer<typeof RoleEnum>;

export const CreateActivitySchema = z.object({
  category: CategoryEnum,
  type: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  occurredOn: z.coerce.date().default(() => new Date()),
  memberId: z.string().optional(),
  source: ActivitySourceEnum.default("MANUAL"),
  notes: z.string().optional(),
  // Optional appliance / power specs for duration-based logging (e.g. AC for 6 hours at 1.5 kW)
  powerKw: z.number().positive().optional(),
})
  // cooking gas is its own category now; older clients still send it under "Food"
  .transform((a) => (a.type === "lpg_cooking" ? { ...a, category: "Cooking" as const } : a));
export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

export const EmissionFactorSchema = z.object({
  category: CategoryEnum,
  type: z.string().min(1),
  unit: z.string().min(1),
  kgCo2ePerUnit: z.number().nonnegative(),
  region: z.string().min(1),
  source: z.string().min(1),
  validFrom: z.coerce.date().default(() => new Date("2024-01-01")),
});
export type EmissionFactorInput = z.infer<typeof EmissionFactorSchema>;
