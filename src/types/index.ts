import { z } from "zod";

export const CategoryEnum = z.enum([
  "Electricity",
  "Transport",
  "Travel",
  "Food",
  "Waste",
]);
export type Category = z.infer<typeof CategoryEnum>;

export const ActivitySourceEnum = z.enum([
  "MANUAL",
  "SMART_METER",
  "RECURRING",
  "BILL_IMPORT",
]);
export type ActivitySource = z.infer<typeof ActivitySourceEnum>;

export const RoleEnum = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
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
});
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
