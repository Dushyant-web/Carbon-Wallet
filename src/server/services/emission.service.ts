import { db } from "@/server/db";
import { factorRepository } from "@/server/repositories/factor.repository";
import { activityRepository } from "@/server/repositories/activity.repository";
import { emissionRepository } from "@/server/repositories/emission.repository";
import { summaryRepository } from "@/server/repositories/summary.repository";
import { scoreService } from "@/server/services/score.service";
import { stateToRegion } from "@/server/factors/registry";
import { CreateActivityInput } from "@/types";

export interface CalculateResult {
  effectiveQuantity: number;
  effectiveUnit: string;
  factorId: string;
  factorValue: number;
  factorSource: string;
  region: string;
  kgCo2e: number;
}

export class EmissionService {
  /**
   * Pure calculation helper that determines effective quantity, emission factor, and kg CO2e.
   */
  async computeEmissions(
    householdState: string,
    input: CreateActivityInput
  ): Promise<CalculateResult> {
    const region = stateToRegion(householdState);

    let factorType = input.type;
    let effectiveQuantity = input.quantity;
    let effectiveUnit = input.unit;

    // Handle AC and Appliance duration conversions (hours -> kWh)
    if (input.category === "Electricity") {
      const isHourUnit = ["hours", "hour", "h", "hrs", "hr"].includes(
        input.unit.toLowerCase().trim()
      );

      if (isHourUnit) {
        // Default power draw for residential AC in India is ~1.5 kW (standard 1.5-Ton inverter AC)
        const powerKw = input.powerKw ?? 1.5;
        effectiveQuantity = Number((input.quantity * powerKw).toFixed(2));
        effectiveUnit = "kWh";
        factorType = "grid_electricity";
      } else if (input.type.includes("ac") || input.type.includes("cooling")) {
        factorType = "grid_electricity";
      }
    }

    // Lookup emission factor from versioned registry
    const factor = await factorRepository.findFactor(
      input.category,
      factorType,
      region
    );

    if (!factor) {
      throw new Error(
        `No emission factor found for category: ${input.category}, type: ${factorType}, region: ${region}`
      );
    }

    // Multiply effective quantity by factor value
    const kgCo2e = Number((effectiveQuantity * factor.kgCo2ePerUnit).toFixed(3));

    return {
      effectiveQuantity,
      effectiveUnit,
      factorId: factor.id,
      factorValue: factor.kgCo2ePerUnit,
      factorSource: factor.source,
      region: factor.region,
      kgCo2e,
    };
  }

  /**
   * Full pipeline:
   * 1. Looks up household to determine regional factors
   * 2. Computes emission via factor registry
   * 3. Writes Activity and EmissionEvent in an atomic transaction
   * 4. Refreshes the Month's Summary and Score
   */
  async calculateAndRecord(
    householdId: string,
    input: CreateActivityInput
  ) {
    const household = await db.household.findUnique({
      where: { id: householdId },
    });

    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    const computed = await this.computeEmissions(household.state, input);
    const occurredDate = new Date(input.occurredOn);
    const monthKey = `${occurredDate.getFullYear()}-${String(
      occurredDate.getMonth() + 1
    ).padStart(2, "0")}`;

    // Execute atomic transaction for Activity + EmissionEvent + MonthlySummary
    return db.$transaction(async (tx) => {
      // 1. Create Activity record
      const activity = await activityRepository.createActivity(
        householdId,
        {
          ...input,
          occurredOn: occurredDate,
        },
        tx as unknown as typeof db
      );

      // 2. Create EmissionEvent record
      const event = await emissionRepository.createEmissionEvent(
        householdId,
        {
          activityId: activity.id,
          factorId: computed.factorId,
          kgCo2e: computed.kgCo2e,
          occurredOn: occurredDate,
        },
        tx as unknown as typeof db
      );

      // 3. Recalculate Monthly Summary rollup
      const summary = await this.recalculateMonthSummary(
        householdId,
        monthKey,
        tx as unknown as typeof db
      );

      return {
        activity,
        emissionEvent: event,
        monthlySummary: summary,
        computation: computed,
      };
    });
  }

  /**
   * Recalculates the monthly total and category breakdown from all events in the month.
   */
  async recalculateMonthSummary(
    householdId: string,
    month: string,
    tx: typeof db = db
  ) {
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const startOfMonth = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    // Get all events in this month for this household
    const events = await emissionRepository.getEventsInRange(
      householdId,
      startOfMonth,
      endOfMonth,
      tx
    );

    // Sum by category
    const byCategory: Record<string, number> = {
      Electricity: 0,
      Transport: 0,
      Travel: 0,
      Food: 0,
      Waste: 0,
    };

    let totalKg = 0;

    for (const ev of events) {
      const cat = ev.activity.category;
      byCategory[cat] = Number(((byCategory[cat] || 0) + ev.kgCo2e).toFixed(2));
      totalKg = Number((totalKg + ev.kgCo2e).toFixed(2));
    }

    // Compute live prototype score using CarbonOS Index formula
    const scoreResult = await scoreService.calculateScore(householdId, month);
    const currentScore = scoreResult.score;

    // Upsert the summary
    const updatedSummary = await summaryRepository.upsertMonthlySummary(
      householdId,
      month,
      {
        totalKg,
        byCategory,
        score: currentScore,
      },
      tx
    );

    return updatedSummary;
  }
}

export const emissionService = new EmissionService();
