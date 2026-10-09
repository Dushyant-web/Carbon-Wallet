import { db } from "@/server/db";
import { Category } from "@/types";

export class FactorRepository {
  /**
   * Find emission factor with regional preference, falling back to IN-NATIONAL.
   */
  async findFactor(category: Category, type: string, region: string = "IN-NATIONAL") {
    // First try the specific region
    let factor = await db.emissionFactor.findUnique({
      where: {
        category_type_region: {
          category,
          type,
          region,
        },
      },
    });

    // Fallback to national if regional not found
    if (!factor && region !== "IN-NATIONAL") {
      factor = await db.emissionFactor.findUnique({
        where: {
          category_type_region: {
            category,
            type,
            region: "IN-NATIONAL",
          },
        },
      });
    }

    return factor;
  }

  async listAllFactors() {
    return db.emissionFactor.findMany({
      orderBy: [{ category: "asc" }, { type: "asc" }, { region: "asc" }],
    });
  }
}

export const factorRepository = new FactorRepository();
