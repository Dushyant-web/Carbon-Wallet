import { cellToParent, latLngToCell } from "h3-js";
import { db } from "@/server/db";
import { stateCode } from "@/lib/carbonId";
import { runAreaJob } from "@/server/services/mohalla.service";
import { ensureSchemes } from "@/server/services/scheme.service";

/**
 * Demo places for the seeded homes: public locality centres, not anyone's address. Stored the same way a real
 * home is (H3 hexagons only), then grouped into mohallas and totalled.
 */
const SEED_PLACES: Record<string, { lat: number; lng: number; pincode: string; locality: string; district: string }> = {
  // the demo login lives in the demo mohalla, Knowledge Park II (knowledgePark.ts)
  hh_01_sharma: { lat: 28.4604, lng: 77.4952, pincode: "201310", locality: "Knowledge Park II", district: "Gautam Buddha Nagar" },
  hh_02_mehta: { lat: 28.5677, lng: 77.2433, pincode: "110024", locality: "Lajpat Nagar", district: "South East Delhi" },
  hh_03_verma: { lat: 28.4744, lng: 77.504, pincode: "201310", locality: "Alpha 1", district: "Gautam Buddha Nagar" },
  hh_04_kapoor: { lat: 28.4916, lng: 77.0945, pincode: "122002", locality: "DLF Phase 3", district: "Gurugram" },
  hh_05_singh: { lat: 26.856, lng: 81.0082, pincode: "226010", locality: "Gomti Nagar", district: "Lucknow" },
  hh_06_gupta: { lat: 26.8549, lng: 75.8243, pincode: "302017", locality: "Malviya Nagar", district: "Jaipur" },
  hh_07_khan: { lat: 12.9352, lng: 77.6245, pincode: "560034", locality: "Koramangala", district: "Bengaluru Urban" },
  hh_08_patel: { lat: 19.1364, lng: 72.8296, pincode: "400053", locality: "Andheri West", district: "Mumbai Suburban" },
  hh_09_iyer: { lat: 13.0012, lng: 80.2565, pincode: "600020", locality: "Adyar", district: "Chennai" },
  hh_10_roy: { lat: 22.5867, lng: 88.4171, pincode: "700091", locality: "Salt Lake", district: "North 24 Parganas" },
};

export async function seedAreas() {
  await ensureSchemes();
  for (const [householdId, p] of Object.entries(SEED_PLACES)) {
    const hh = await db.household.findUnique({ where: { id: householdId }, select: { state: true } });
    if (!hh) continue;
    const h3Cell = latLngToCell(p.lat, p.lng, 10);
    const data = {
      h3Cell,
      h3Area: cellToParent(h3Cell, 7),
      pincode: p.pincode,
      locality: p.locality,
      district: p.district,
      state: stateCode(hh.state),
      source: "MANUAL",
      consentAt: new Date(),
    };
    await db.householdLocation.upsert({ where: { householdId }, create: { householdId, ...data }, update: data });
  }
  const out = await runAreaJob();
  console.log(`📍 Mohallas formed; ${out.areas} area totals for ${out.months.length} months`);
}

if (process.argv[1]?.includes("areas")) {
  seedAreas()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
