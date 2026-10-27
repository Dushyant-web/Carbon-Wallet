import { db } from "@/server/db";
import { gasesFromCategories, type Gas } from "@/lib/ghg";

export interface MonthlySummaryData {
  totalKg: number;
  byCategory: Record<string, number>;
  /** kg CO₂e per gas; worked out from the categories when not given */
  byGas?: Record<Gas, number>;
  score: number;
}

export class SummaryRepository {
  /**
   * Get monthly summary for a specific month scoped strictly to householdId.
   */
  async getMonthlySummary(householdId: string, month: string) {
    return db.monthlySummary.findUnique({
      where: {
        householdId_month: {
          householdId,
          month,
        },
      },
    });
  }

  /**
   * Upsert monthly summary scoped strictly to householdId.
   */
  async upsertMonthlySummary(
    householdId: string,
    month: string,
    data: MonthlySummaryData,
    tx: typeof db = db
  ) {
    const byCategoryJson = JSON.stringify(data.byCategory);
    const byGasJson = JSON.stringify(data.byGas ?? gasesFromCategories(data.byCategory));

    return tx.monthlySummary.upsert({
      where: {
        householdId_month: {
          householdId,
          month,
        },
      },
      update: {
        totalKg: data.totalKg,
        byCategory: byCategoryJson,
        byGas: byGasJson,
        score: data.score,
      },
      create: {
        householdId,
        month,
        totalKg: data.totalKg,
        byCategory: byCategoryJson,
        byGas: byGasJson,
        score: data.score,
      },
    });
  }

  /**
   * Get historical monthly summaries for a household, ordered chronologically.
   */
  async getHistory(householdId: string, limit: number = 12) {
    return db.monthlySummary.findMany({
      where: { householdId },
      orderBy: { month: "asc" },
      take: limit,
    });
  }
}

export const summaryRepository = new SummaryRepository();
