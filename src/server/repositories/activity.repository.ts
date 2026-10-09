import { db } from "@/server/db";
import { CreateActivityInput } from "@/types";

export class ActivityRepository {
  /**
   * Create an activity scoped strictly to householdId.
   */
  async createActivity(
    householdId: string,
    data: CreateActivityInput,
    tx: typeof db = db
  ) {
    return tx.activity.create({
      data: {
        householdId,
        memberId: data.memberId,
        category: data.category,
        type: data.type,
        quantity: data.quantity,
        unit: data.unit,
        occurredOn: data.occurredOn,
        source: data.source,
        notes: data.notes,
      },
    });
  }

  /**
   * List activities scoped strictly to householdId with pagination and filters.
   */
  async listActivities(
    householdId: string,
    options?: {
      category?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: {
      householdId: string;
      category?: string;
      occurredOn?: { gte?: Date; lte?: Date };
    } = { householdId };

    if (options?.category && options.category !== "all") {
      where.category = options.category;
    }

    if (options?.from || options?.to) {
      where.occurredOn = {};
      if (options.from) where.occurredOn.gte = options.from;
      if (options.to) where.occurredOn.lte = options.to;
    }

    return db.activity.findMany({
      where,
      orderBy: { occurredOn: "desc" },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
      include: {
        emissionEvents: {
          include: {
            factor: true,
          },
        },
      },
    });
  }

  /**
   * Count total activities scoped strictly to householdId for pagination.
   */
  async countActivities(
    householdId: string,
    options?: {
      category?: string;
      from?: Date;
      to?: Date;
    }
  ) {
    const where: {
      householdId: string;
      category?: string;
      occurredOn?: { gte?: Date; lte?: Date };
    } = { householdId };

    if (options?.category && options.category !== "all") {
      where.category = options.category;
    }

    if (options?.from || options?.to) {
      where.occurredOn = {};
      if (options.from) where.occurredOn.gte = options.from;
      if (options.to) where.occurredOn.lte = options.to;
    }

    return db.activity.count({ where });
  }

  /**
   * Find single activity by ID scoped strictly to householdId.
   */
  async findById(householdId: string, activityId: string) {
    return db.activity.findFirst({
      where: {
        id: activityId,
        householdId,
      },
      include: {
        emissionEvents: {
          include: {
            factor: true,
          },
        },
      },
    });
  }
}

export const activityRepository = new ActivityRepository();
