import { db } from "@/server/db";
import { seedEmissionFactors, stateToRegion } from "@/server/factors/registry";
import { HOUSEHOLD_PROFILES } from "./households.config";
import { generateRawActivities } from "./generator";
import { calibrateHouseholdActivities } from "./calibrate";
import { scoreService } from "@/server/services/score.service";
import { hashPassword } from "@/server/auth/password";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { refreshRecommendations } from "@/server/services/recommendation.service";

// Demo logins (seed data only): every seeded member shares DEMO_PASSWORD; one platform admin.
const DEMO_PASSWORD = "CarbonDemo#2026";
const DEMO_LOGIN_HOUSEHOLD = "Sharma Residence";
const ADMIN = { name: "Platform Admin", email: "admin@carbonwallet.in", password: "AdminDemo#2026" };

export async function seedDatabase() {
  console.log("🌱 Starting CarbonOS calibrated database seeding...");

  const demoHash = await hashPassword(DEMO_PASSWORD);
  await db.user.upsert({
    where: { email: ADMIN.email },
    update: { platformRole: "ADMIN", status: "ACTIVE", passwordHash: await hashPassword(ADMIN.password) },
    create: { name: ADMIN.name, email: ADMIN.email, platformRole: "ADMIN", passwordHash: await hashPassword(ADMIN.password) },
  });

  // 1. Seed Factor Registry
  console.log("⚡ Seeding versioned Indian emission factor registry...");
  await seedEmissionFactors();

  // Pre-load all factors from DB for fast ID mapping
  const allFactors = await db.emissionFactor.findMany();
  const getFactorId = (category: string, type: string, region: string) => {
    let f = allFactors.find(
      (x) => x.category === category && x.type === type && x.region === region
    );
    if (!f) {
      f = allFactors.find(
        (x) => x.category === category && x.type === type && x.region === "IN-NATIONAL"
      );
    }
    if (!f && category === "Electricity") {
      f = allFactors.find(
        (x) => x.category === "Electricity" && x.type === "grid_electricity" && x.region === region
      );
    }
    return f?.id || allFactors[0].id;
  };

  const resultsSummary: Array<{
    name: string;
    targetKg: number;
    actualKg: number;
    score: number;
    priorKg: number;
    trendPct: string;
  }> = [];

  // 2. Iterate each of the 10 households
  for (const profile of HOUSEHOLD_PROFILES) {
    console.log(`🏠 Seeding household: ${profile.name} (${profile.city}, ${profile.state})...`);

    // Upsert household
    const household = await db.household.upsert({
      where: { id: profile.id },
      update: {
        name: profile.name,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        size: profile.size,
        homeType: profile.homeType,
        floorAreaM2: profile.floorAreaM2,
        monthlyBudgetInr: profile.monthlyBudgetInr,
        joinCode: profile.joinCode,
        status: "ACTIVE",
      },
      create: {
        id: profile.id,
        name: profile.name,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        size: profile.size,
        homeType: profile.homeType,
        floorAreaM2: profile.floorAreaM2,
        monthlyBudgetInr: profile.monthlyBudgetInr,
        joinCode: profile.joinCode,
        status: "ACTIVE",
      },
    });

    // Upsert Members
    for (const mem of profile.members) {
      const loginFields = { passwordHash: demoHash, status: "ACTIVE" }; // every seeded demo member can log in
      const user = await db.user.upsert({
        where: { email: mem.email },
        update: { name: mem.name, ...loginFields },
        create: { name: mem.name, email: mem.email, ...loginFields },
      });

      await db.membership.upsert({
        where: {
          householdId_userId: {
            householdId: household.id,
            userId: user.id,
          },
        },
        update: { role: mem.role, status: "ACTIVE" },
        create: {
          householdId: household.id,
          userId: user.id,
          role: mem.role,
          status: "ACTIVE",
        },
      });
    }

    // Upsert Appliances
    await db.appliance.deleteMany({ where: { householdId: household.id } });
    for (const app of profile.appliances) {
      await db.appliance.create({
        data: {
          householdId: household.id,
          name: app.name,
          type: app.type,
          rating: app.rating,
          powerKw: app.powerKw,
          avgHoursPerDay: app.avgHoursPerDay,
        },
      });
    }

    // Upsert Vehicles
    await db.vehicle.deleteMany({ where: { householdId: household.id } });
    for (const veh of profile.vehicles) {
      await db.vehicle.create({
        data: {
          householdId: household.id,
          name: veh.name,
          type: veh.type,
          fuel: veh.fuel,
          kmPerUnit: veh.kmPerUnit,
          monthlyKm: veh.monthlyKm,
        },
      });
    }

    // Upsert Recommendations
    await db.recommendation.deleteMany({ where: { householdId: household.id } });
    for (const rec of profile.recommendations) {
      await db.recommendation.create({
        data: {
          householdId: household.id,
          action: rec.action,
          description: rec.description,
          category: rec.category,
          kgSaved: rec.kgSaved,
          inrSaved: rec.inrSaved,
          difficulty: rec.difficulty,
          status: rec.status,
        },
      });
    }

    // Clean old activities, events, and monthly summaries for this household
    await db.emissionEvent.deleteMany({ where: { householdId: household.id } });
    await db.activity.deleteMany({ where: { householdId: household.id } });
    await db.monthlySummary.deleteMany({ where: { householdId: household.id } });

    // 3. Generate raw activities with fixed seed
    const rawActivities = generateRawActivities(profile, 42);

    // 4. Calibrate activities to hit targets
    const calibratedMonths = calibrateHouseholdActivities(profile, rawActivities);
    const region = stateToRegion(profile.state);

    // 5. Insert Activities & Emission Events
    for (const monthResult of calibratedMonths) {
      for (const act of monthResult.calibratedActivities) {
        let factorType = act.type;
        if (act.category === "Electricity") {
          factorType = "grid_electricity";
        }

        const factorId = getFactorId(act.category, factorType, region);
        const factorObj = allFactors.find((f) => f.id === factorId);
        const factorVal = factorObj?.kgCo2ePerUnit || 0.675;

        let effectiveQty = act.quantity;
        if (act.category === "Electricity" && ["hours", "hour", "h"].includes(act.unit.toLowerCase())) {
          effectiveQty = act.quantity * (act.powerKw ?? 1.5);
        }

        const eventKg = Number((effectiveQty * factorVal).toFixed(3));

        const createdAct = await db.activity.create({
          data: {
            householdId: household.id,
            category: act.category,
            type: act.type,
            quantity: act.quantity,
            unit: act.unit,
            occurredOn: act.occurredOn,
            source: act.source,
            notes: act.notes,
          },
        });

        await db.emissionEvent.create({
          data: {
            householdId: household.id,
            activityId: createdAct.id,
            factorId,
            kgCo2e: eventKg,
            occurredOn: act.occurredOn,
          },
        });
      }

      // Initial summary insert
      await db.monthlySummary.create({
        data: {
          householdId: household.id,
          month: monthResult.month,
          totalKg: monthResult.totalKg,
          byCategory: JSON.stringify(monthResult.byCategory),
          score: 70, // will compute below
        },
      });
    }

    // Pending suggestions are computed from this home's own AC, car and tariff (seeded accepted/completed
    // actions stay as history)
    await refreshRecommendations(household.id);

    // Compute live CarbonOS Index for each month
    for (const monthResult of calibratedMonths) {
      const scoreObj = await scoreService.calculateScore(household.id, monthResult.month);
      await db.monthlySummary.update({
        where: {
          householdId_month: {
            householdId: household.id,
            month: monthResult.month,
          },
        },
        data: {
          score: scoreObj.score,
        },
      });
    }

    // Read back current month (2026-03) and prior month (2026-02)
    const currentSummary = await db.monthlySummary.findUnique({
      where: { householdId_month: { householdId: household.id, month: "2026-03" } },
    });
    const priorSummary = await db.monthlySummary.findUnique({
      where: { householdId_month: { householdId: household.id, month: "2026-02" } },
    });

    const currKg = currentSummary?.totalKg || 0;
    const prevKg = priorSummary?.totalKg || 0;
    const diffPct = prevKg > 0 ? (((currKg - prevKg) / prevKg) * 100).toFixed(1) : "0.0";

    resultsSummary.push({
      name: profile.name,
      targetKg: profile.targetMonthlyKg,
      actualKg: currKg,
      score: currentSummary?.score || 0,
      priorKg: prevKg,
      trendPct: `${diffPct}%`,
    });
  }

  console.log("\n================ CALIBRATION RESULTS SUMMARY ================");
  console.table(resultsSummary);
  console.log("=============================================================\n");
  // Permanent Carbon IDs + public QR tokens, assigned in config order so IDs are stable.
  for (const profile of HOUSEHOLD_PROFILES) {
    const hh = await db.household.findFirst({ where: { name: profile.name }, select: { id: true } });
    if (hh) await ensureHouseholdIdentity(hh.id);
  }
  // Demo-only: a fixed, documented token so the landing page QR always opens a real record.
  await db.household.updateMany({ where: { name: DEMO_LOGIN_HOUSEHOLD }, data: { publicToken: "sharma-demo" } });

  console.log("✅ Seed completed successfully with 10 calibrated households!");
  console.log(`🔑 Demo user: arjun.sharma@example.com / ${DEMO_PASSWORD}  ·  Admin: ${ADMIN.email} / ${ADMIN.password}`);
}

if (process.argv[1]?.includes("seed")) {
  seedDatabase()
    .catch((e) => {
      console.error("❌ Seeding error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
