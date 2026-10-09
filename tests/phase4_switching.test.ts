import { describe, it, expect, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { GET as getOverview } from "@/app/api/households/[id]/overview/route";
import { GET as getHouseholds } from "@/app/api/households/route";
import { useAppStore } from "@/store";

describe("Phase 4: App Shell & Household Switching Integration", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("Done when criterion: Switching changes the active household and all data updates dynamically", async () => {
    // 1. Initial State: Sharma Residence
    useAppStore.getState().setActiveHouseholdId("hh_01_sharma");
    expect(useAppStore.getState().activeHouseholdId).toBe("hh_01_sharma");

    const reqSharma = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/overview");
    const resSharma = await getOverview(reqSharma, { params: Promise.resolve({ id: "hh_01_sharma" }) });
    expect(resSharma.status).toBe(200);

    const sharmaData = await resSharma.json();
    expect(sharmaData.household.name).toBe("Sharma Residence");
    expect(sharmaData.kpi.totalEmissions).toBe(286);
    expect(sharmaData.kpi.trendPct).toBe(-8.4);
    expect(sharmaData.kpi.topContributor.category).toBe("Electricity");

    // 2. Switch to Khan Household (148 kg, EV, Bengalore)
    useAppStore.getState().setActiveHouseholdId("hh_07_khan");
    expect(useAppStore.getState().activeHouseholdId).toBe("hh_07_khan");

    const reqKhan = new NextRequest("http://localhost:3000/api/households/hh_07_khan/overview");
    const resKhan = await getOverview(reqKhan, { params: Promise.resolve({ id: "hh_07_khan" }) });
    expect(resKhan.status).toBe(200);

    const khanData = await resKhan.json();
    expect(khanData.household.name).toBe("Khan Household");
    expect(khanData.kpi.totalEmissions).toBe(148);
    expect(khanData.household.city).toBe("Bengaluru");
    expect(khanData.vehicles[0].fuel).toBe("Electric");

    // 3. Switch to Kapoor Residence (398 kg, Luxury Diesel SUV, Gurugram)
    useAppStore.getState().setActiveHouseholdId("hh_04_kapoor");
    expect(useAppStore.getState().activeHouseholdId).toBe("hh_04_kapoor");

    const reqKapoor = new NextRequest("http://localhost:3000/api/households/hh_04_kapoor/overview");
    const resKapoor = await getOverview(reqKapoor, { params: Promise.resolve({ id: "hh_04_kapoor" }) });
    expect(resKapoor.status).toBe(200);

    const kapoorData = await resKapoor.json();
    expect(kapoorData.household.name).toBe("Kapoor Residence");
    expect(kapoorData.kpi.totalEmissions).toBe(398);
    expect(kapoorData.kpi.topContributor.category).toBe("Transport");
  });

  it("verifies household list endpoint returns all managed entities with real rollups", async () => {
    const res = await getHouseholds(new NextRequest("http://localhost:3000/api/households"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.households)).toBe(true);
    expect(data.households.length).toBeGreaterThanOrEqual(10);

    const sharma = data.households.find((h: { id: string }) => h.id === "hh_01_sharma");
    expect(sharma).toBeDefined();
    expect(sharma.currentEmissions).toBe(286);
  });
});
