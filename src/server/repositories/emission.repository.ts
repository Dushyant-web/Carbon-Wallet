import { db } from "@/server/db";
import { COUNTED_ACTIVITY } from "@/server/counted";

export class EmissionRepository {
  /**
   * Create an emission event scoped strictly to householdId.
   */
  async createEmissionEvent(
    householdId: string,
    data: {
      activityId: string;
      factorId: string;
      kgCo2e: number;
      occurredOn: Date;
    },
    tx: typeof db = db
  ) {
    return tx.emissionEvent.create({
      data: {
        householdId,
        activityId: data.activityId,
        factorId: data.factorId,
        kgCo2e: data.kgCo2e,
        occurredOn: data.occurredOn,
      },
      include: {
        factor: true,
      },
    });
  }

  /**
   * List emission events in date range scoped strictly to householdId.
   */
  async getEventsInRange(
    householdId: string,
    start: Date,
    end: Date,
    tx: typeof db = db
  ) {
    return tx.emissionEvent.findMany({
      where: {
        householdId,
        occurredOn: {
          gte: start,
          lte: end,
        },
        // Logged electricity that a confirmed bill covers is already inside the bill's kWh.
        activity: COUNTED_ACTIVITY,
      },
      include: {
        activity: true,
        factor: true,
      },
      orderBy: { occurredOn: "asc" },
    });
  }
}

export const emissionRepository = new EmissionRepository();
