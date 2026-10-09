import { HouseholdProfile } from "./households.config";
import { GeneratedActivity } from "./generator";
import { stateToRegion, OFFICIAL_EMISSION_FACTORS } from "@/server/factors/registry";

export interface CalibratedMonthlyResult {
  month: string; // "YYYY-MM"
  targetKg: number;
  calibratedActivities: GeneratedActivity[];
  totalKg: number;
  byCategory: Record<string, number>;
}

// In-memory factor map for fast calibration during seeding
function getFactorValue(category: string, type: string, region: string): number {
  const match = OFFICIAL_EMISSION_FACTORS.find(
    (f) => f.category === category && f.type === type && f.region === region
  );
  if (match) return match.kgCo2ePerUnit;

  const fallback = OFFICIAL_EMISSION_FACTORS.find(
    (f) => f.category === category && f.type === type && f.region === "IN-NATIONAL"
  );
  if (fallback) return fallback.kgCo2ePerUnit;

  if (category === "Electricity") {
    const gridMatch = OFFICIAL_EMISSION_FACTORS.find(
      (f) => f.category === "Electricity" && f.type === "grid_electricity" && f.region === region
    );
    if (gridMatch) return gridMatch.kgCo2ePerUnit;
  }

  return 0.5;
}

function calculateActivityKg(act: GeneratedActivity, region: string): number {
  let effectiveQty = act.quantity;
  let factorType = act.type;

  if (act.category === "Electricity") {
    if (["hours", "hour", "h"].includes(act.unit.toLowerCase())) {
      const powerKw = act.powerKw ?? 1.5;
      effectiveQty = act.quantity * powerKw;
      factorType = "grid_electricity";
    } else if (act.type.includes("ac")) {
      factorType = "grid_electricity";
    }
  }

  const factorValue = getFactorValue(act.category, factorType, region);
  return effectiveQty * factorValue;
}

/**
 * Calibrates generated activities for a household so each month hits its intended target and trend.
 */
export function calibrateHouseholdActivities(
  profile: HouseholdProfile,
  rawActivities: GeneratedActivity[]
): CalibratedMonthlyResult[] {
  const region = stateToRegion(profile.state);

  // Group activities by month (YYYY-MM)
  const activitiesByMonth: Record<string, GeneratedActivity[]> = {};
  for (const act of rawActivities) {
    const d = act.occurredOn;
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!activitiesByMonth[monthKey]) {
      activitiesByMonth[monthKey] = [];
    }
    activitiesByMonth[monthKey].push(act);
  }

  // Monthly targets for 12 months ending 2026-03
  // Month 2026-03 = exact targetMonthlyKg
  // Month 2026-02 = targetMonthlyKg / (1 + intendedTrendPct / 100)
  // Months 2025-05, 2025-06 = summer peak ~1.25x - 1.4x of target
  // Remaining months = smooth curve
  const currentTarget = profile.targetMonthlyKg;
  const priorTarget = Number(
    (currentTarget / (1 + profile.intendedTrendPct / 100)).toFixed(1)
  );

  const monthTargets: Record<string, number> = {
    "2026-03": currentTarget,
    "2026-02": priorTarget,
    "2026-01": Number((priorTarget * 1.02).toFixed(1)),
    "2025-12": Number((priorTarget * 1.04).toFixed(1)),
    "2025-11": Number((priorTarget * 1.06).toFixed(1)),
    "2025-10": Number((priorTarget * 1.08).toFixed(1)),
    "2025-09": Number((priorTarget * 1.12).toFixed(1)),
    "2025-08": Number((priorTarget * 1.18).toFixed(1)),
    "2025-07": Number((priorTarget * 1.25).toFixed(1)),
    "2025-06": Number((priorTarget * 1.35).toFixed(1)), // Summer peak
    "2025-05": Number((priorTarget * 1.38).toFixed(1)), // Summer peak
    "2025-04": Number((priorTarget * 1.15).toFixed(1)),
  };

  const results: CalibratedMonthlyResult[] = [];

  for (const [monthKey, targetKg] of Object.entries(monthTargets)) {
    const monthActs = activitiesByMonth[monthKey] || [];
    if (monthActs.length === 0) continue;

    // Calculate raw sums for primary category vs others
    const primaryTargetKg = Number((targetKg * (profile.primarySharePct / 100)).toFixed(2));
    const otherTargetKg = Number((targetKg - primaryTargetKg).toFixed(2));

    const primaryActs = monthActs.filter((a) => a.category === profile.primaryCategory);
    const otherActs = monthActs.filter((a) => a.category !== profile.primaryCategory);

    let rawPrimarySum = 0;
    for (const act of primaryActs) {
      rawPrimarySum += calculateActivityKg(act, region);
    }

    let rawOtherSum = 0;
    for (const act of otherActs) {
      rawOtherSum += calculateActivityKg(act, region);
    }

    // Scale primary activities
    if (rawPrimarySum > 0) {
      const primaryScale = primaryTargetKg / rawPrimarySum;
      for (const act of primaryActs) {
        act.quantity = Number((act.quantity * primaryScale).toFixed(2));
      }
    }

    // Scale other activities
    if (rawOtherSum > 0) {
      const otherScale = otherTargetKg / rawOtherSum;
      for (const act of otherActs) {
        act.quantity = Number((act.quantity * otherScale).toFixed(2));
      }
    }

    // Measure scaled sum
    let scaledSum = 0;
    const byCategory: Record<string, number> = {
      Electricity: 0,
      Transport: 0,
      Travel: 0,
      Food: 0,
      Waste: 0,
    };

    for (const act of monthActs) {
      const kg = calculateActivityKg(act, region);
      byCategory[act.category] = Number(((byCategory[act.category] || 0) + kg).toFixed(2));
      scaledSum += kg;
    }

    // Fine-tune residual difference on primary category activity to hit target exactly
    const diff = targetKg - scaledSum;
    if (Math.abs(diff) > 0.01 && monthActs.length > 0) {
      // Find an activity in primary category
      const targetAct =
        monthActs.find((a) => a.category === profile.primaryCategory) || monthActs[0];
      const factorVal = getFactorValue(
        targetAct.category,
        targetAct.type,
        region
      );
      const isHours = ["hours", "hour", "h"].includes(targetAct.unit.toLowerCase());
      const effectiveFactor = isHours ? factorVal * (targetAct.powerKw ?? 1.5) : factorVal;

      if (effectiveFactor > 0) {
        targetAct.quantity = Number(
          (targetAct.quantity + diff / effectiveFactor).toFixed(2)
        );
      }
    }

    // Final recount
    let finalTotalKg = 0;
    const finalByCategory: Record<string, number> = {
      Electricity: 0,
      Transport: 0,
      Travel: 0,
      Food: 0,
      Waste: 0,
    };

    for (const act of monthActs) {
      const kg = calculateActivityKg(act, region);
      finalByCategory[act.category] = Number(
        ((finalByCategory[act.category] || 0) + kg).toFixed(2)
      );
      finalTotalKg += kg;
    }

    results.push({
      month: monthKey,
      targetKg,
      calibratedActivities: monthActs,
      totalKg: Number(finalTotalKg.toFixed(1)),
      byCategory: finalByCategory,
    });
  }

  // Sort chronologically
  results.sort((a, b) => a.month.localeCompare(b.month));

  return results;
}
