import { addGases, emptyGases, roundGases, splitByGas } from "@/lib/ghg";
import { db } from "@/server/db";
import { factorRepository } from "@/server/repositories/factor.repository";
import { activityRepository } from "@/server/repositories/activity.repository";
import { emissionRepository } from "@/server/repositories/emission.repository";
import { summaryRepository } from "@/server/repositories/summary.repository";
import { scoreService } from "@/server/services/score.service";
import { seedEmissionFactors, stateToRegion } from "@/server/factors/registry";
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

let registrySynced = false;

const utcMonth = (d: Date) => [new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))];
// A km trip of this type is replaced by fuel fill-ups of this fuel (same rule as fuel.service.ts)
const TRIP_FUEL: Record<string, string[]> = { petrol_car: ["Petrol", "Hybrid"], diesel_car: ["Diesel"], cng_car: ["CNG"] };

export class EmissionService {
  /**
   * Whether a new activity is already inside something counted in full: electricity inside a bill's period
   * (the bill has it), or a car trip in a month whose fuel fill-ups for that car are logged. The activity
   * stays visible but stops counting, exactly as when the bill or fill-up arrives after it.
   */
  async coverageFor(
    householdId: string,
    input: Pick<CreateActivityInput, "category" | "type" | "source">,
    occurredOn: Date
  ): Promise<{ coveredByBillId?: string; coveredByFuelLogId?: string }> {
    if (input.category === "Electricity" && input.source !== "BILL_IMPORT") {
      const bill = await db.bill.findFirst({
        where: { householdId, periodStart: { lte: occurredOn }, periodEnd: { gt: occurredOn } },
        select: { id: true },
      });
      if (bill) return { coveredByBillId: bill.id };
    }
    const fuels = input.category === "Transport" ? TRIP_FUEL[input.type] : undefined;
    if (fuels) {
      const vehicles = await db.vehicle.findMany({ where: { householdId, fuel: { in: fuels } }, select: { id: true } });
      if (vehicles.length === 1) {
        const [from, to] = utcMonth(occurredOn);
        const log = await db.fuelLog.findFirst({
          where: { householdId, vehicleId: vehicles[0].id, filledOn: { gte: from, lt: to } },
          orderBy: { filledOn: "desc" },
          select: { id: true },
        });
        if (log) return { coveredByFuelLogId: log.id };
      }
    }
    return {};
  }

  /** What an activity would add, without recording anything (for previews while someone fills a form). */
  async preview(householdId: string, input: CreateActivityInput) {
    const household = await db.household.findUnique({ where: { id: householdId }, select: { state: true } });
    if (!household) throw new Error(`Household ${householdId} not found`);
    const occurredOn = new Date(input.occurredOn);
    const computed = await this.computeEmissions(household.state, input, householdId);
    const coverage = await this.coverageFor(householdId, input, occurredOn);
    return {
      ...computed,
      counted: !coverage.coveredByBillId && !coverage.coveredByFuelLogId,
      coveredBy: coverage.coveredByBillId ? "bill" : coverage.coveredByFuelLogId ? "fuel" : null,
    };
  }

  /**
   * Pure calculation helper that determines effective quantity, emission factor, and kg CO2e.
   */
  async computeEmissions(
    householdState: string,
    input: CreateActivityInput,
    householdId?: string
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
        // AC draw, best source first: given on the log → measured from this home's bills → the AC's rated
        // power → 1.5 kW (a typical 1.5-ton split AC) as the last resort.
        const powerKw = input.powerKw ?? (householdId ? await this.acKw(householdId) : null) ?? 1.5;
        effectiveQuantity = Number((input.quantity * powerKw).toFixed(2));
        effectiveUnit = "kWh";
        factorType = "grid_electricity";
      } else if (input.type.includes("ac") || input.type.includes("cooling")) {
        factorType = "grid_electricity";
      }
    }

    // Lookup emission factor from versioned registry. A database seeded before a factor was added to the
    // official registry gets the registry synced once, then the lookup is retried.
    let factor = await factorRepository.findFactor(input.category, factorType, region);
    if (!factor && !registrySynced) {
      registrySynced = true;
      await seedEmissionFactors();
      factor = await factorRepository.findFactor(input.category, factorType, region);
    }

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

  private async acKw(householdId: string): Promise<number | null> {
    const cal = await db.calibration.findFirst({
      where: { householdId, method: { not: "default" } },
      orderBy: { createdAt: "desc" },
    });
    if (cal) return cal.acKw;
    const ac = await db.appliance.findFirst({ where: { householdId, type: "AC" }, orderBy: { powerKw: "desc" } });
    return ac?.powerKw ?? null;
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

    const computed = await this.computeEmissions(household.state, input, householdId);
    const occurredDate = new Date(input.occurredOn);
    const coverage = await this.coverageFor(householdId, input, occurredDate);
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
      if (coverage.coveredByBillId || coverage.coveredByFuelLogId) {
        await tx.activity.update({ where: { id: activity.id }, data: coverage });
      }

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
    // and by gas: each event split by what its factor is made of (CO₂, CH₄, N₂O, HFCs; food and travel as CO₂e)
    const byGas = emptyGases();

    for (const ev of events) {
      const cat = ev.activity.category;
      byCategory[cat] = Number(((byCategory[cat] || 0) + ev.kgCo2e).toFixed(2));
      totalKg = Number((totalKg + ev.kgCo2e).toFixed(2));
      addGases(byGas, splitByGas(ev.factor.type, ev.kgCo2e));
    }

    // Score from this month's fresh total (the stored summary is about to be replaced)
    const scoreResult = await scoreService.calculateScore(householdId, month, totalKg);
    const currentScore = scoreResult.score;

    // Upsert the summary
    const updatedSummary = await summaryRepository.upsertMonthlySummary(
      householdId,
      month,
      {
        totalKg,
        byCategory,
        byGas: roundGases(byGas),
        score: currentScore,
      },
      tx
    );

    return updatedSummary;
  }
}

export const emissionService = new EmissionService();
