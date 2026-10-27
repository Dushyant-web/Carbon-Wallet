import type { Prisma } from "@prisma/client";

/**
 * Categories a home's carbon is counted in: its energy (electricity, cooking gas), travel and AC gas.
 * Food and waste are not part of a home's carbon here; old logs of them stay in history but add nothing.
 */
export const NOT_COUNTED_CATEGORIES = ["Food", "Waste"];

/**
 * An activity counts towards totals unless something more accurate already includes it (logged electricity
 * inside a confirmed bill, or km-based car trips replaced by a fuel fill-up), or it is food or waste.
 * Cooking gas logged under "Food" before it had its own category still counts.
 */
export const COUNTED_ACTIVITY = {
  coveredByBillId: null,
  coveredByFuelLogId: null,
  OR: [{ category: { notIn: NOT_COUNTED_CATEGORIES } }, { type: "lpg_cooking" }],
} satisfies Prisma.ActivityWhereInput;

/** The category an activity counts under, or null when it isn't counted (cooking gas is "Cooking"). */
export function countedCategory(category: string, factorType: string | null | undefined): string | null {
  if (factorType === "lpg_cooking") return "Cooking";
  return NOT_COUNTED_CATEGORIES.includes(category) ? null : category;
}
