/**
 * An activity counts towards totals unless something more accurate already includes it:
 * logged electricity inside a confirmed bill, or km-based car trips replaced by a fuel fill-up.
 */
export const COUNTED_ACTIVITY = { coveredByBillId: null, coveredByFuelLogId: null } as const;
