import { db } from "@/server/db";

export class HouseholdRepository {
  /**
   * Find household by ID.
   */
  async findById(householdId: string) {
    return db.household.findUnique({
      where: { id: householdId },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
        appliances: true,
        vehicles: true,
      },
    });
  }

  /**
   * Find household by join code.
   */
  async findByJoinCode(joinCode: string) {
    return db.household.findUnique({
      where: { joinCode },
    });
  }

  /**
   * List all households (with summary info).
   */
  async listAll() {
    return db.household.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * Create a new household.
   */
  async create(data: {
    name: string;
    city: string;
    state: string;
    country?: string;
    size: number;
    homeType: string;
    floorAreaM2: number;
    monthlyBudgetInr?: number;
    joinCode: string;
  }) {
    return db.household.create({
      data: {
        ...data,
        country: data.country ?? "IN",
      },
    });
  }
}

export const householdRepository = new HouseholdRepository();
