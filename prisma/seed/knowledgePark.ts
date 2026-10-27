import { cellToLatLng, cellToParent, latLngToCell, polygonToCells } from "h3-js";
import { db } from "@/server/db";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { runAreaJob } from "@/server/services/mohalla.service";
import { ensureSchemes } from "@/server/services/scheme.service";
import { GRID_KG_PER_KWH, monthlyAllowance } from "@/lib/allowance";
import { seedCatalogues } from "./catalogue";

/**
 * Demo mohalla: Knowledge Park II, Greater Noida (UP, pincode 201310), filled with made-up families on real ground:
 * one home in each of ~90% of the sector's ~120 m H3 cells. Every row is marked `demo` in the database.
 *
 *   npm run seed:kp2      (after the main seed; safe to run again: it replaces its own rows)
 *
 * The outline is drawn from OpenStreetMap landmarks, because OSM has no boundary for the sector:
 * NIET plot 19 (28.46276, 77.49076) and plot 14 (28.4607, 77.49347), the Knowledge Park II metro station
 * (28.45700, 77.50025) and the APJ Abdul Kalam Road bus stops (28.4620, 77.4968).
 */
export const KP2 = {
  name: "Knowledge Park II",
  city: "Greater Noida",
  district: "Gautam Buddha Nagar",
  pincode: "201310",
  outline: [
    [28.4656, 77.4876],
    [28.4663, 77.4972],
    [28.4593, 77.5013],
    [28.4549, 77.4993],
    [28.4559, 77.4883],
  ] as [number, number][],
  sources: [
    "OpenStreetMap: Noida Institute of Engineering and Technology, plots 14 and 19, Knowledge Park II",
    "OpenStreetMap: Knowledge Park II metro station (Aqua Line), and bus stops on APJ Abdul Kalam Road",
  ],
};

// Family names common in and around Greater Noida, plus families who moved here for work (made-up households)
const SURNAMES = [
  "Bhati", "Nagar", "Yadav", "Chauhan", "Gupta", "Khan", "Ansari", "Kaur", "Thomas", "Mishra", "Tiwari", "Saxena", "Agarwal",
  "Rawat", "Negi", "Pandey", "Jain", "Qureshi", "Gill", "Das", "Nair", "Reddy", "Patel", "Joshi", "Kumar", "Prasad", "Malhotra",
  "Arora", "Siddiqui", "Verma", "Singh", "Bisht", "Rastogi", "Tyagi", "D'Souza", "Kulkarni", "Ghosh", "Chaudhary", "Sharma",
  "Gautam", "Kasana", "Awana", "Baisla", "Rathi", "Saini", "Rana", "Sisodia", "Dixit", "Shukla", "Srivastava", "Bansal", "Goel",
  "Mittal", "Kapoor", "Bhatia", "Sethi", "Ahmed", "Rizvi", "Hussain", "Fernandes", "Pillai", "Menon", "Iyer", "Rao", "Naidu",
  "Mukherjee", "Banerjee", "Sen", "Bora", "Hazarika", "Lal", "Paswan", "Mandal", "Sahu", "Patil", "Deshmukh", "Shinde", "Desai",
];
const HOME_WORDS = ["Parivar", "Niwas", "Residence", "Bhawan", "Ghar", "House", "Kutir", "Sadan"];
const FAMILIES: [string, number][] = SURNAMES.map((s, i) => [`${s} ${HOME_WORDS[i % HOME_WORDS.length]}`, 2 + ((i * 7 + 3) % 6)]);

// A ≈ 12-month seasonal pattern of AC hours a day in the NCR (Jan → Dec)
const AC_HOURS = [0, 0, 1, 4, 7, 8, 6, 5, 5, 3, 0.5, 0];
const FAN_KWH_DAY = [0.3, 0.4, 0.9, 1.6, 2, 2, 1.8, 1.8, 1.7, 1.2, 0.6, 0.3];
const GEYSER_HOURS = [0.7, 0.5, 0.2, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.6];
const FUEL_KG: Record<string, number> = { Petrol: 2.31, Diesel: 2.68, CNG: 2.75 };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


/** Homes cover about 90% of the sector: one home in each of 90% of its ~120 m H3 cells, at the cell's centre. */
export function kp2Points(share = 0.9, seed = 2026): [number, number][] {
  const r = rng(seed);
  const cells = polygonToCells(KP2.outline, 10).sort();
  // a seeded shuffle, so the same cells are left empty on every run
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, Math.round(cells.length * share)).map((c) => cellToLatLng(c) as [number, number]);
}

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 9 + i, 1)); // Oct 2025 → Sep 2026
  return d.toISOString().slice(0, 7);
});

export async function seedKnowledgePark() {
  await ensureSchemes();
  const r = rng(77);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const shopAppliances = await db.merchant.findFirst({ where: { businessName: "Demo Appliances" } });
  const shopMotors = await db.merchant.findFirst({ where: { businessName: "Demo Motors" } });
  if (!(await db.catalogueItem.count())) await seedCatalogues();
  const catalogue = await db.catalogueItem.findMany();
  const product = (sku: string) => catalogue.find((c) => c.sku === sku) ?? null;
  // which catalogue product a demo item stands for
  const skuFor = (type: string, rating: string, fuel?: string) =>
    type === "AC" ? (rating.startsWith("5") ? "AC-15-5S-INV" : "AC-15-3S-FIX")
    : type === "Refrigerator" ? (rating === "5_STAR" ? "FR-340-5S" : "FR-260-3S")
    : type === "WashingMachine" ? "WM-7-5S"
    : type === "TwoWheeler" ? (fuel === "Electric" ? "EV-VOLT-30" : "PET-ZOOM-110")
    : type === "Car" && fuel === "CNG" ? "CNG-HATCH"
    : null;
  const points = kp2Points(0.9).slice(0, FAMILIES.length);

  // start clean: only this seed's own rows (shop history first, it would otherwise outlive the homes)
  await db.merchantSale.deleteMany({ where: { householdId: { startsWith: "hh_kp2_" } } });
  await db.household.deleteMany({ where: { id: { startsWith: "hh_kp2_" } } });

  for (let i = 0; i < points.length; i++) {
    const [name, size] = FAMILIES[i];
    const id = `hh_kp2_${String(i + 1).padStart(2, "0")}`;
    const [lat, lng] = points[i];
    const homeType = size >= 6 ? "Independent house" : pick(["Apartment", "Apartment", "Builder floor"]);
    const area = Math.round(45 + size * 18 + r() * 40);
    await db.household.create({
      data: { id, name, city: KP2.city, state: "UP", size, homeType, floorAreaM2: area, joinCode: `KP2${String(i + 1).padStart(2, "0")}${Math.floor(r() * 1e6)}`, demo: true },
    });
    await ensureHouseholdIdentity(id);
    const h3Cell = cellIdAt(lat, lng);
    await db.householdLocation.create({
      data: { householdId: id, h3Cell, h3Area: cellToParent(h3Cell, 7), pincode: KP2.pincode, locality: KP2.name, district: KP2.district, state: "UP", source: "GPS", consentAt: new Date() },
    });

    // what the home owns: richer, bigger homes have more ACs; roughly half the items came through a shop counter
    const wealth = r();
    const acCount = wealth > 0.8 ? 3 : wealth > 0.45 ? 2 : wealth > 0.15 ? 1 : 0;
    const acs: { kw: number; rating: string; name: string }[] = [];
    for (let a = 0; a < acCount; a++) {
      const rating = pick(["5_STAR_INVERTER", "5_STAR_INVERTER", "3_STAR", "3_STAR", "NON_INVERTER", "4_STAR"]);
      acs.push({ kw: rating.includes("INVERTER") && rating.startsWith("5") ? 1.2 : rating === "NON_INVERTER" ? 1.8 : 1.5, rating, name: ["Bedroom AC", "Drawing room AC", "Kids' room AC"][a] });
    }
    const appliances = [
      ...acs.map((a) => ({ name: a.name, type: "AC", rating: a.rating, powerKw: a.kw, avgHoursPerDay: 6 })),
      { name: "Refrigerator", type: "Refrigerator", rating: pick(["3_STAR", "4_STAR", "5_STAR"]), powerKw: 0.25, avgHoursPerDay: 24 },
      ...(r() > 0.35 ? [{ name: "Geyser", type: "WaterHeater", rating: "UNRATED", powerKw: 2, avgHoursPerDay: 0.5 }] : []),
      ...(r() > 0.5 ? [{ name: "Washing machine", type: "WashingMachine", rating: "5_STAR", powerKw: 0.5, avgHoursPerDay: 0.8 }] : []),
    ];
    const vehicles = [
      ...(r() > 0.3 ? [r() > 0.75 ? { name: "Electric scooter", type: "TwoWheeler", fuel: "Electric", kmPerUnit: 30, monthlyKm: 450, year: 2025 } : { name: "Scooter", type: "TwoWheeler", fuel: "Petrol", kmPerUnit: 45, monthlyKm: 500, year: pick([2012, 2016, 2019, 2022]) }] : []),
      ...(wealth > 0.55 ? [{ name: pick(["Hatchback", "Sedan", "SUV"]), type: "Car", fuel: pick(["Petrol", "Petrol", "CNG", "Diesel"]), kmPerUnit: 15, monthlyKm: Math.round(500 + r() * 700), year: pick([2010, 2015, 2018, 2021, 2024]) }] : []),
    ];

    for (const a of appliances) {
      const fromShop = !!shopAppliances && r() > 0.45 && a.type !== "WaterHeater";
      const created = await db.appliance.create({
        data: { householdId: id, ...a, source: fromShop ? "MERCHANT" : "OWNER", ...(fromShop ? { brand: pick(["Coolwell", "Frostline", "Himtek"]), model: `DM-${Math.floor(r() * 900 + 100)}`, serialNo: `KP2-${id}-${a.name}` } : {}) },
      });
      if (fromShop) {
        const p = product(skuFor(a.type, a.rating) ?? "");
        await db.merchantSale.create({
          data: {
            merchantId: shopAppliances!.id,
            householdId: id,
            kind: "APPLIANCE",
            applianceId: created.id,
            summary: p?.title ?? `${a.name} · ${a.rating.replace(/_/g, " ").toLowerCase()}`,
            catalogueItemId: p?.id ?? null,
            priceInr: p?.priceInr ?? null,
            createdAt: new Date(Date.UTC(2025, 9 + Math.floor(r() * 12), 1 + Math.floor(r() * 27))),
          },
        });
      }
    }
    for (const v of vehicles) {
      const fromShop = !!shopMotors && v.year >= 2024;
      const created = await db.vehicle.create({ data: { householdId: id, ...v, source: fromShop ? "MERCHANT" : "OWNER" } });
      if (fromShop) {
        const p = product(skuFor(v.type, "", v.fuel) ?? "");
        await db.merchantSale.create({
          data: {
            merchantId: shopMotors!.id,
            householdId: id,
            kind: "VEHICLE",
            vehicleId: created.id,
            summary: p?.title ?? `${v.name} (${v.fuel.toLowerCase()}, ${v.year})`,
            catalogueItemId: p?.id ?? null,
            priceInr: p?.priceInr ?? null,
            createdAt: new Date(Date.UTC(2025, 10 + Math.floor(r() * 10), 1 + Math.floor(r() * 27))),
          },
        });
      }
    }

    // twelve months of totals, the way bills and fill-ups would add up
    const habit = 0.6 + r() * 0.8;
    const allowance = monthlyAllowance("UP", size);
    for (const month of months) {
      const m = Number(month.slice(5)) - 1;
      const days = new Date(Date.UTC(Number(month.slice(0, 4)), m + 1, 0)).getUTCDate();
      const acKwh = acs.reduce((s, a) => s + a.kw * AC_HOURS[m] * habit * 0.7 * days, 0);
      const baseKwh = (1.2 + 0.35 * size + FAN_KWH_DAY[m] * (1 + size / 4)) * days + 0.25 * 24 * 0.4 * days;
      const geyserKwh = appliances.some((a) => a.type === "WaterHeater") ? 2 * GEYSER_HOURS[m] * size * 0.5 * days : 0;
      const electricity = (acKwh + baseKwh + geyserKwh) * GRID_KG_PER_KWH;
      const cooking = 3.4 * size * 2.98 * (0.9 + r() * 0.2);
      const transport = vehicles.reduce((s, v) => s + (v.fuel === "Electric" ? (v.monthlyKm / v.kmPerUnit) * GRID_KG_PER_KWH : (v.monthlyKm / v.kmPerUnit) * (FUEL_KG[v.fuel] ?? 2.31)), 0);
      const total = electricity + cooking + transport;
      const ratio = total / allowance;
      await db.monthlySummary.create({
        data: {
          householdId: id,
          month,
          totalKg: round1(total),
          byCategory: JSON.stringify({ Electricity: round1(electricity), Cooking: round1(cooking), Transport: round1(transport) }),
          score: Math.round(Math.min(98, Math.max(5, (100 * (1.8 - ratio)) / 1.4))),
        },
      });
    }

    // a few homes asked a shop about a scheme
    if (shopMotors && vehicles.some((v) => v.fuel === "Petrol" && v.type === "TwoWheeler") && r() > 0.6) {
      const scheme = await db.scheme.findUnique({ where: { slug: "pm-e-drive" } });
      if (scheme) await db.schemeHelp.create({ data: { householdId: id, schemeId: scheme.id, merchantId: shopMotors.id, status: r() > 0.5 ? "APPLIED" : "EXPLAINED" } });
    }
  }

  const out = await runAreaJob();
  console.log(`🏘️  Knowledge Park II: ${points.length} example homes covering ~90% of the sector; ${out.areas} area totals`);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const cellIdAt = (lat: number, lng: number) => latLngToCell(lat, lng, 10);

if (process.argv[1]?.includes("knowledgePark")) {
  seedKnowledgePark()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
