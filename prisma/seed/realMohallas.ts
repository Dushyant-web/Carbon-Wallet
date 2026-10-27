import { cellToLatLng, cellToParent, polygonToCells } from "h3-js";
import { db } from "@/server/db";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { runAreaJob } from "@/server/services/mohalla.service";
import { monthlyAllowance, RUPEES_PER_KWH } from "@/lib/allowance";
import { CNG_KG_CO2E_PER_KG, DIESEL_KG_CO2E_PER_L, GRID_KG_CO2E_PER_KWH, LPG_KG_CO2E_PER_KG, PETROL_KG_CO2E_PER_L, co2ePerUnit, gasesFromCategories } from "@/lib/ghg";
import { ANCHORS, LPG_KG_PER_HOME_MONTH, VEHICLES, WASTE, YEARLY_GROWTH } from "./data/realAnchors";
import { KP2 } from "./knowledgePark";

/**
 * Fills every demo mohalla with simulated homes on real ground, sized by the area of the locality, with named
 * (made-up) owners, 24 months of bills and monthly totals, ACs and vehicles.
 *
 *   npx tsx --env-file=.env prisma/seed/realMohallas.ts      (needs the internet once, for the weather)
 *
 * What is real: each state's home electricity ÷ its homes (prisma/seed/data/realAnchors.ts), LPG per home, vehicle
 * ownership, waste per person, the ERA5 weather month by month at each locality (Open-Meteo archive), and the ground (OpenStreetMap
 * boundaries, or a stated radius around the locality where OSM has none). What is simulated: who lives where, and
 * how each home differs from its state's average (a log-normal spread). Safe to run again: it replaces its own rows.
 */

type LatLng = [number, number];
type Locality = {
  key: string;
  name: string;
  city: string;
  state: string;
  stateName: string;
  district: string;
  pincodes: string[];
  region: keyof typeof NAMES;
  discom: string;
  shape: { polygons: LatLng[][] } | { aroundHousehold: string; radiusKm: number };
  /** existing demo homes to refill (Knowledge Park II) instead of creating new ones */
  existingPrefix?: string;
};

const rect = (s: number, w: number, n: number, e: number): LatLng[] => [[s, w], [s, e], [n, e], [n, w]];

// © OpenStreetMap contributors (ODbL): Lajpat Nagar relation 18092543; Koramangala 1st–8th Block and National Games
// Village ways; DLF Phase 3 U, V and T Block ways; the Alpha 1 residential area. Bounding boxes of those shapes.
const LOCALITIES: Locality[] = [
  { key: "kp2", name: KP2.name, city: KP2.city, state: "UP", stateName: "Uttar Pradesh", district: KP2.district, pincodes: [KP2.pincode], region: "ncrUp", discom: "NPCL", shape: { polygons: [KP2.outline] }, existingPrefix: "hh_kp2_" },
  { key: "lajpat", name: "Lajpat Nagar", city: "Delhi", state: "DL", stateName: "Delhi", district: "South East Delhi", pincodes: ["110024"], region: "delhi", discom: "BSES Rajdhani", shape: { polygons: [rect(28.5583, 77.2317, 28.5788, 77.2505)] } },
  { key: "alpha1", name: "Alpha 1", city: "Greater Noida", state: "UP", stateName: "Uttar Pradesh", district: "Gautam Buddha Nagar", pincodes: ["201310"], region: "ncrUp", discom: "NPCL", shape: { polygons: [[[28.4742, 77.50432], [28.46947, 77.50779], [28.47384, 77.51563], [28.47862, 77.51216]]] } },
  { key: "dlf3", name: "DLF Phase 3", city: "Gurugram", state: "HR", stateName: "Haryana", district: "Gurugram", pincodes: ["122002"], region: "gurugram", discom: "DHBVN", shape: { polygons: [rect(28.4863, 77.092, 28.4966, 77.1002), rect(28.493, 77.1079, 28.4941, 77.1093), rect(28.4892, 77.1035, 28.4933, 77.1093)] } },
  { key: "gomti", name: "Gomti Nagar", city: "Lucknow", state: "UP", stateName: "Uttar Pradesh", district: "Lucknow", pincodes: ["226010"], region: "lucknow", discom: "MVVNL", shape: { aroundHousehold: "hh_05_singh", radiusKm: 1.8 } },
  { key: "malviya", name: "Malviya Nagar", city: "Jaipur", state: "RJ", stateName: "Rajasthan", district: "Jaipur", pincodes: ["302017"], region: "jaipur", discom: "JVVNL", shape: { aroundHousehold: "hh_06_gupta", radiusKm: 1.2 } },
  {
    key: "koramangala", name: "Koramangala", city: "Bengaluru", state: "KA", stateName: "Karnataka", district: "Bengaluru Urban", pincodes: ["560034", "560095"], region: "bengaluru", discom: "BESCOM",
    shape: { polygons: [rect(12.9247, 77.6211, 12.9312, 77.6292), rect(12.9413, 77.6201, 12.9493, 77.6262), rect(12.9345, 77.611, 12.9381, 77.6172), rect(12.9364, 77.6143, 12.9458, 77.6226), rect(12.9214, 77.6173, 12.9273, 77.6284), rect(12.9295, 77.6245, 12.9371, 77.633), rect(12.9244, 77.6284, 12.9299, 77.6377)] },
  },
  { key: "andheri", name: "Andheri West", city: "Mumbai", state: "MH", stateName: "Maharashtra", district: "Mumbai Suburban", pincodes: ["400053", "400058", "400061"], region: "mumbai", discom: "Adani Electricity Mumbai", shape: { aroundHousehold: "hh_08_patel", radiusKm: 1.5 } },
  { key: "adyar", name: "Adyar", city: "Chennai", state: "TN", stateName: "Tamil Nadu", district: "Chennai", pincodes: ["600020"], region: "chennai", discom: "TNPDCL", shape: { aroundHousehold: "hh_09_iyer", radiusKm: 1.3 } },
  { key: "saltlake", name: "Salt Lake", city: "Kolkata", state: "WB", stateName: "West Bengal", district: "North 24 Parganas", pincodes: ["700064", "700091", "700106"], region: "kolkata", discom: "WBSEDCL", shape: { aroundHousehold: "hh_10_roy", radiusKm: 1.5 } },
];

// Made-up families with surnames common in each place (and families who moved there for work)
const NAMES = {
  delhi: { last: ["Malhotra", "Kapoor", "Khanna", "Arora", "Sethi", "Bhatia", "Chawla", "Ahuja", "Gupta", "Aggarwal", "Bansal", "Jain", "Sharma", "Verma", "Singh", "Kohli", "Anand", "Talwar", "Mehra", "Bedi", "Saxena", "Khan", "Qureshi", "Siddiqui", "Gill", "Grover", "Narang", "Dhawan", "Suri", "Tandon", "Das", "Nair"], first: NORTH() },
  ncrUp: { last: ["Bhati", "Nagar", "Yadav", "Chauhan", "Tyagi", "Sharma", "Gupta", "Singh", "Kasana", "Awana", "Baisla", "Rathi", "Saini", "Mittal", "Goel", "Agarwal", "Rawat", "Negi", "Mishra", "Pandey", "Ansari", "Thomas", "Kumar", "Prasad"], first: NORTH() },
  gurugram: { last: ["Yadav", "Ahlawat", "Dahiya", "Malik", "Hooda", "Rao", "Kataria", "Sangwan", "Chaudhary", "Arora", "Khurana", "Bhalla", "Kapoor", "Mehta", "Sood", "Gill", "Sandhu", "Grewal", "Jindal", "Goyal", "Menon", "Iyer"], first: NORTH() },
  lucknow: { last: ["Srivastava", "Tiwari", "Shukla", "Mishra", "Tripathi", "Dwivedi", "Pandey", "Verma", "Saxena", "Nigam", "Khan", "Rizvi", "Zaidi", "Naqvi", "Siddiqui", "Ansari", "Yadav", "Singh", "Awasthi", "Bajpai"], first: NORTH() },
  jaipur: { last: ["Agarwal", "Khandelwal", "Maheshwari", "Rathore", "Shekhawat", "Meena", "Sharma", "Joshi", "Jain", "Goyal", "Mathur", "Saini", "Choudhary", "Bhati", "Mittal", "Paliwal", "Vyas", "Purohit", "Soni", "Kumawat"], first: NORTH() },
  bengaluru: { last: ["Rao", "Reddy", "Gowda", "Shetty", "Hegde", "Naik", "Kulkarni", "Bhat", "Kamath", "Iyengar", "Nair", "Menon", "Pillai", "Thomas", "D'Souza", "Fernandes", "Murthy", "Prasad", "Raju", "Srinivas", "Sharma", "Gupta"], first: ["Srinivas", "Lakshmi", "Ravi", "Deepa", "Prakash", "Anitha", "Suresh", "Kavya", "Mahesh", "Divya", "Naveen", "Shruti", "Venkatesh", "Meera", "Kiran", "Asha", "Raghu", "Pavithra", "Arjun", "Sneha"] },
  mumbai: { last: ["Patil", "Deshmukh", "Shinde", "Jadhav", "Kulkarni", "Joshi", "Gokhale", "Sawant", "Pawar", "Shah", "Mehta", "Desai", "Kapadia", "Pereira", "D'Mello", "Iyer", "Shetty", "Kamat", "Naik", "Sheikh", "Malhotra", "Khan"], first: ["Sachin", "Snehal", "Prashant", "Madhuri", "Rahul", "Aishwarya", "Nilesh", "Sayali", "Ashish", "Pallavi", "Vinay", "Rupali", "Kunal", "Neha", "Amol", "Swati", "Tejas", "Ketaki", "Rohan", "Manasi"] },
  chennai: { last: ["Iyer", "Iyengar", "Subramanian", "Krishnan", "Raman", "Venkatesan", "Rajan", "Natarajan", "Sundaram", "Balasubramanian", "Ganesan", "Murugan", "Pillai", "Chettiar", "Mudaliar", "Rao", "Joseph", "Fernando", "Abraham", "Hussain"], first: ["Karthik", "Lakshmi", "Senthil", "Revathi", "Arun", "Priya", "Ganesh", "Meenakshi", "Vijay", "Gayathri", "Ramesh", "Kavitha", "Saravanan", "Deepa", "Bala", "Anitha", "Murali", "Sowmya", "Hari", "Janani"] },
  kolkata: { last: ["Banerjee", "Chatterjee", "Mukherjee", "Ganguly", "Bose", "Ghosh", "Sen", "Das", "Dutta", "Roy", "Basu", "Chakraborty", "Bhattacharya", "Majumdar", "Mitra", "Saha", "Sarkar", "Paul", "Haldar", "Biswas"], first: ["Sourav", "Rituparna", "Arijit", "Moumita", "Debashis", "Sutapa", "Anirban", "Payel", "Subhash", "Tanushree", "Abhijit", "Sanchita", "Partha", "Mitali", "Indranil", "Ananya", "Saikat", "Rimpa", "Tapas", "Sharmistha"] },
};
function NORTH() {
  return ["Rajesh", "Sunita", "Amit", "Neha", "Vikas", "Pooja", "Rakesh", "Anjali", "Sanjay", "Kavita", "Rohit", "Priya", "Deepak", "Meena", "Ajay", "Ritu", "Manoj", "Shalini", "Arun", "Seema", "Imran", "Farah", "Harpreet", "Simran"];
}
const HOME_WORDS: Record<keyof typeof NAMES, string[]> = {
  delhi: ["Residence", "Niwas", "House", "Bhawan"],
  ncrUp: ["Niwas", "Residence", "Bhawan", "Parivar"],
  gurugram: ["Residence", "House", "Villa", "Niwas"],
  lucknow: ["Niwas", "Bhawan", "Kothi", "Residence"],
  jaipur: ["Haveli", "Niwas", "Bhawan", "Residence"],
  bengaluru: ["Nilaya", "Residence", "House", "Nivas"],
  mumbai: ["Residence", "Niwas", "House", "Sadan"],
  chennai: ["Illam", "Nivas", "Residence", "House"],
  kolkata: ["Bari", "Bhavan", "Residence", "Niwas"],
};

const MONTHS = Array.from({ length: 24 }, (_, i) => new Date(Date.UTC(2024, 9 + i, 1)).toISOString().slice(0, 7)); // Oct 2024 → Sep 2026
const DENSITY_PER_KM2 = 45; // simulated homes per km² of locality (a sample: real localities have thousands of homes)
const MAX_HOMES = 300;
const RES10_KM2 = 0.0150475; // average area of an H3 resolution-10 cell

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const r1 = (n: number) => Math.round(n * 10) / 10;
const daysIn = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0)).getUTCDate();

async function cellsOf(loc: Locality): Promise<string[]> {
  if ("polygons" in loc.shape) return [...new Set(loc.shape.polygons.flatMap((p) => polygonToCells(p, 10)))].sort();
  const home = await db.householdLocation.findUniqueOrThrow({ where: { householdId: loc.shape.aroundHousehold } });
  const [lat, lng] = cellToLatLng(home.h3Cell);
  const { radiusKm } = loc.shape;
  const circle: LatLng[] = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * 2 * Math.PI;
    return [lat + (radiusKm / 111.32) * Math.sin(a), lng + (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)];
  });
  return polygonToCells(circle, 10).sort();
}

// --- weather: real monthly cooling degree days at the city (engine, ERA5), else a north-India normal -------------
const NORMAL_MEAN_C = [14.3, 17.6, 22.9, 29.0, 32.8, 33.4, 31.4, 30.4, 29.6, 26.2, 20.6, 15.8];
function normalCdd(month: string) {
  const mu = NORMAL_MEAN_C[Number(month.slice(5)) - 1];
  const s = 3;
  const z = (mu - 24) / s;
  const pdf = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
  const cdf = 0.5 * (1 + erf(z / Math.SQRT2));
  return (s * pdf + (mu - 24) * cdf) * daysIn(month);
}
function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
/**
 * Monthly cooling degree days (base 24 °C, as the engine uses) at a point, from one request for all 24 months of
 * daily mean temperatures in the ERA5 archive (Open-Meteo). Retries a flaky network before falling back to normals.
 */
async function monthlyCdd(lat: number, lng: number, label: string): Promise<{ cdd: Record<string, number>; real: boolean }> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    `&start_date=${MONTHS[0]}-01&end_date=${MONTHS[MONTHS.length - 1]}-${daysIn(MONTHS[MONTHS.length - 1])}&daily=temperature_2m_mean&timezone=Asia%2FKolkata`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { daily: { time: string[]; temperature_2m_mean: (number | null)[] } };
      const sums: Record<string, { cdd: number; days: number }> = {};
      body.daily.time.forEach((d, i) => {
        const t = body.daily.temperature_2m_mean[i];
        if (t === null) return;
        const m = d.slice(0, 7);
        sums[m] ??= { cdd: 0, days: 0 };
        sums[m].cdd += Math.max(0, t - 24);
        sums[m].days++;
      });
      const cdd = Object.fromEntries(MONTHS.map((m) => [m, sums[m]?.days ? (sums[m].cdd * daysIn(m)) / sums[m].days : normalCdd(m)]));
      return { cdd, real: true };
    } catch (e) {
      if (attempt === 4) {
        console.warn(`  weather for ${label} unavailable (${(e as Error).message}); using climate normals`);
        break;
      }
      await new Promise((ok) => setTimeout(ok, 2000 * attempt));
    }
  }
  return { cdd: Object.fromEntries(MONTHS.map((m) => [m, normalCdd(m)])), real: false };
}

const centreOf = (cells: string[]) => {
  const pts = cells.map((c) => cellToLatLng(c));
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] as LatLng;
};

type HomePlan = {
  id: string;
  size: number;
  scale: number; // how this home differs from the state's average (log-normal, mean 1)
  acs: { kw: number; rating: string; name: string }[];
  vehicles: { name: string; type: string; fuel: string; kmPerUnit: number; monthlyKm: number; year: number }[];
  hasGeyser: boolean;
};

function planHome(r: () => number, id: string, size: number, anchorKwh: number, region: keyof typeof NAMES, state: string): HomePlan {
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const sigma = 0.45;
  const scale = Math.exp(gauss() * sigma - (sigma * sigma) / 2) * Math.pow(size / 4.1, 0.35);
  const meanKwh = anchorKwh * scale;
  const acCount = Math.max(0, Math.min(3, Math.floor((meanKwh - 90) / 110)));
  const acs = Array.from({ length: acCount }, (_, a) => {
    const rating = ["5_STAR_INVERTER", "5_STAR_INVERTER", "3_STAR", "3_STAR", "4_STAR", "NON_INVERTER"][Math.floor(r() * 6)];
    return { kw: rating === "5_STAR_INVERTER" ? 1.2 : rating === "NON_INVERTER" ? 1.8 : 1.5, rating, name: ["Bedroom AC", "Drawing room AC", "Kids' room AC"][a] };
  });
  const vehicles: HomePlan["vehicles"] = [];
  const twoWheeler = VEHICLES.twoWheelerShare.byState[state] ?? VEHICLES.twoWheelerShare.national;
  if (r() < twoWheeler) {
    const ev = r() < 0.02;
    vehicles.push({ name: ev ? "Electric scooter" : r() < 0.5 ? "Scooter" : "Motorcycle", type: "TwoWheeler", fuel: ev ? "Electric" : "Petrol", kmPerUnit: ev ? 30 : 45, monthlyKm: Math.round(VEHICLES.twoWheelerKmPerMonth * (0.6 + r() * 0.8)), year: 2012 + Math.floor(r() * 14) });
  }
  if (r() < VEHICLES.carShare.value * Math.min(2.5, scale)) {
    const f = r();
    const fuel = f < 0.62 ? "Petrol" : f < 0.82 ? "Diesel" : "CNG";
    vehicles.push({ name: ["Hatchback", "Sedan", "SUV"][Math.floor(r() * 3)], type: "Car", fuel, kmPerUnit: fuel === "CNG" ? 25 : fuel === "Diesel" ? 17 : 15, monthlyKm: Math.round(VEHICLES.carKmPerMonth * (0.6 + r() * 0.8)), year: 2010 + Math.floor(r() * 16) });
  }
  const coldWinter = ["delhi", "ncrUp", "gurugram", "lucknow", "jaipur", "bengaluru"].includes(region);
  return { id, size, scale, acs, vehicles, hasGeyser: coldWinter ? r() < 0.6 : r() < 0.15 };
}

/** kWh for each month: base use, plus cooling that follows the month's real heat. Scaled to the state later. */
function rawKwh(plan: HomePlan, cdd: Record<string, number>, cityCoolingShare: number, r: () => number) {
  const share = Math.min(0.6, cityCoolingShare * (plan.acs.length ? 1.3 : 0.55));
  const out: Record<string, number> = {};
  for (let y = 0; y < 2; y++) {
    const block = MONTHS.slice(y * 12, y * 12 + 12);
    const yearCdd = block.reduce((s, m) => s + cdd[m], 0) || 1;
    for (const m of block) {
      const base = (1 - share) * (daysIn(m) / 30.42);
      const cooling = share * 12 * (cdd[m] / yearCdd);
      const growth = y === 0 ? 1 / YEARLY_GROWTH : 1;
      out[m] = plan.scale * (base + cooling) * growth * (1 + (r() - 0.5) * 0.1); // relative; kWh after scaling
    }
  }
  return out;
}

async function fillLocality(loc: Locality, deltaCddDelhi: number) {
  const anchor = ANCHORS[loc.state];
  const r = rng(hash(loc.key));
  const cells = await cellsOf(loc);
  const [clat, clng] = centreOf(cells);
  const { cdd, real } = await monthlyCdd(clat, clng, loc.name);
  const lastYear = MONTHS.slice(12);
  const cityCdd = lastYear.reduce((s, m) => s + cdd[m], 0);
  // the share of a year's home electricity that follows the heat: ~38% in Delhi (summer bills ~2.5× winter), less
  // where it is milder
  const coolingShare = Math.max(0.03, Math.min(0.45, 0.38 * (cityCdd / deltaCddDelhi)));
  const names = NAMES[loc.region];
  const words = HOME_WORDS[loc.region];

  // who lives here: existing demo homes (Knowledge Park II) or new ones, one per H3 cell, sized by area
  type Home = { plan: HomePlan; cell: string; isNew: boolean; owner?: string; name: string };
  const homes: Home[] = [];
  if (loc.existingPrefix) {
    const existing = await db.household.findMany({ where: { id: { startsWith: loc.existingPrefix } }, include: { appliances: true, vehicles: true, location: true, memberships: true } });
    for (const h of existing) {
      const plan = planHome(r, h.id, h.size, anchor.kwhPerHomeMonth, loc.region, loc.state);
      plan.acs = h.appliances.filter((a) => a.type === "AC").map((a) => ({ kw: a.powerKw, rating: a.rating, name: a.name ?? "AC" }));
      plan.vehicles = h.vehicles.map((v) => ({ name: v.name ?? v.type, type: v.type, fuel: v.fuel, kmPerUnit: v.kmPerUnit, monthlyKm: v.monthlyKm, year: v.year ?? 2018 }));
      plan.hasGeyser = h.appliances.some((a) => a.type === "WaterHeater");
      homes.push({ plan, cell: h.location?.h3Cell ?? cells[0], isNew: false, owner: h.memberships.find((m) => m.role === "OWNER")?.userId, name: h.name });
    }
  } else {
    const shuffled = [...cells];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const areaKm2 = cells.length * RES10_KM2;
    const n = Math.min(MAX_HOMES, Math.round(areaKm2 * DENSITY_PER_KM2), Math.floor(cells.length * 0.9));
    const sizes = [2, 3, 3, 4, 4, 4, 5, 5, 6, 7];
    for (let i = 0; i < n; i++) {
      const size = sizes[Math.floor(r() * sizes.length)];
      const last = names.last[Math.floor(r() * names.last.length)];
      const id = `hh_sim_${loc.key}_${String(i + 1).padStart(3, "0")}`;
      homes.push({ plan: planHome(r, id, size, anchor.kwhPerHomeMonth, loc.region, loc.state), cell: shuffled[i], isNew: true, name: `${last} ${words[Math.floor(r() * words.length)]}` });
    }
  }

  // electricity: each home's monthly pattern, then the whole locality scaled so its homes average the state's real
  // figure over the last 12 months (the state's total, divided among its homes)
  const raw = homes.map((h) => rawKwh(h.plan, cdd, coolingShare, r));
  const lastYearMean = raw.reduce((s, k) => s + lastYear.reduce((a, m) => a + k[m], 0) / 12, 0) / homes.length;
  const k = anchor.kwhPerHomeMonth / lastYearMean;

  for (let i = 0; i < homes.length; i++) {
    const h = homes[i];
    const plan = h.plan;
    let ownerId = h.owner;
    if (h.isNew) {
      const first = names.first[Math.floor(r() * names.first.length)];
      const surname = h.name.split(" ")[0];
      const user = await db.user.create({
        data: { name: `${first} ${surname}`, email: `${first}.${surname}.${loc.key}${i + 1}@residents.example`.toLowerCase().replace(/[^a-z0-9.@]/g, ""), platformRole: "USER", status: "ACTIVE" },
      });
      ownerId = user.id;
      const homeType = plan.size >= 6 ? "Independent house" : ["Apartment", "Apartment", "Builder floor", "Independent house"][Math.floor(r() * 4)];
      await db.household.create({
        data: {
          id: plan.id,
          name: h.name,
          city: loc.city,
          state: loc.state,
          size: plan.size,
          homeType,
          floorAreaM2: Math.round(40 + plan.size * 16 + r() * 50 * plan.scale),
          joinCode: `SIM-${loc.key}-${i + 1}`,
          demo: true,
          memberships: { create: { userId: user.id, role: "OWNER", status: "ACTIVE" } },
        },
      });
      await ensureHouseholdIdentity(plan.id);
      await db.householdLocation.create({
        data: { householdId: plan.id, h3Cell: h.cell, h3Area: cellToParent(h.cell, 7), pincode: loc.pincodes[Math.floor(r() * loc.pincodes.length)], locality: loc.name, district: loc.district, state: loc.state, source: "MANUAL", consentAt: new Date() },
      });
      await db.appliance.createMany({
        data: [
          ...plan.acs.map((a) => ({ householdId: plan.id, name: a.name, type: "AC", rating: a.rating, powerKw: a.kw, avgHoursPerDay: 6 })),
          { householdId: plan.id, name: "Refrigerator", type: "Refrigerator", rating: ["3_STAR", "4_STAR", "5_STAR"][Math.floor(r() * 3)], powerKw: 0.25, avgHoursPerDay: 24 },
          ...(plan.hasGeyser ? [{ householdId: plan.id, name: "Geyser", type: "WaterHeater", rating: "UNRATED", powerKw: 2, avgHoursPerDay: 0.5 }] : []),
          ...(plan.scale > 0.8 ? [{ householdId: plan.id, name: "Washing machine", type: "WashingMachine", rating: "5_STAR", powerKw: 0.5, avgHoursPerDay: 0.8 }] : []),
        ],
      });
      if (plan.vehicles.length) await db.vehicle.createMany({ data: plan.vehicles.map((v) => ({ householdId: plan.id, ...v })) });
    } else {
      await db.monthlySummary.deleteMany({ where: { householdId: plan.id } });
      await db.bill.deleteMany({ where: { householdId: plan.id, source: "MANUAL" } });
    }

    const allowance = monthlyAllowance(loc.state, plan.size);
    const summaries = [];
    const bills = [];
    for (const m of MONTHS) {
      const kwh = Math.max(15, Math.round(raw[i][m] * k)); // a connected home always draws something
      const days = daysIn(m);
      const electricity = kwh * GRID_KG_CO2E_PER_KWH;
      const cooking = LPG_KG_PER_HOME_MONTH.value * Math.sqrt(plan.size / 4.4) * LPG_KG_CO2E_PER_KG * (0.9 + r() * 0.2);
      const transport = plan.vehicles.reduce((s, v) => {
        const units = (v.monthlyKm * (0.85 + r() * 0.3)) / v.kmPerUnit;
        const per = v.fuel === "Electric" ? GRID_KG_CO2E_PER_KWH : v.fuel === "Diesel" ? DIESEL_KG_CO2E_PER_L : v.fuel === "CNG" ? CNG_KG_CO2E_PER_KG : PETROL_KG_CO2E_PER_L;
        return s + units * per;
      }, 0);
      const waste = plan.size * WASTE.kgPerPersonDay * days * co2ePerUnit("solid_waste_unsegregated", 0.55);
      const byCategory = { Electricity: r1(electricity), Cooking: r1(cooking), Transport: r1(transport), Waste: r1(waste) };
      const total = r1(byCategory.Electricity + byCategory.Cooking + byCategory.Transport + byCategory.Waste);
      const ratio = total / allowance;
      summaries.push({
        householdId: plan.id,
        month: m,
        totalKg: total,
        byCategory: JSON.stringify(byCategory),
        byGas: JSON.stringify(gasesFromCategories(byCategory)),
        score: Math.round(Math.min(98, Math.max(5, (100 * (1.8 - ratio)) / 1.4))),
      });
      const [y, mo] = m.split("-").map(Number);
      bills.push({
        householdId: plan.id,
        periodStart: new Date(Date.UTC(y, mo - 1, 1)),
        periodEnd: new Date(Date.UTC(y, mo, 1)),
        kwh,
        amountInr: Math.round(kwh * RUPEES_PER_KWH),
        discom: loc.discom,
        source: "MANUAL",
        confirmedById: ownerId ?? null,
      });
    }
    await db.monthlySummary.createMany({ data: summaries });
    await db.bill.createMany({ data: bills });
  }

  const check = homes.length ? Math.round(raw.reduce((s, kk) => s + lastYear.reduce((a, m) => a + Math.round(kk[m] * k), 0) / 12, 0) / homes.length) : 0;
  console.log(
    `  ${loc.name.padEnd(18)} ${String(homes.length).padStart(3)} homes on ${(cells.length * RES10_KM2).toFixed(1)} km² · ${check} kWh/home/month (state: ${anchor.kwhPerHomeMonth}, ${anchor.basis}) · cooling share ${Math.round(coolingShare * 100)}% · weather ${real ? "ERA5" : "normals"}`,
  );
  return homes.length;
}

export async function seedRealMohallas() {
  // start clean: this script's own homes and owners (their items, bills and months go with them)
  await db.household.deleteMany({ where: { id: { startsWith: "hh_sim_" } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@residents.example" } } });

  const delhi = await monthlyCdd(28.6139, 77.209, "Delhi"); // New Delhi, the reference for the cooling share
  const delhiYear = MONTHS.slice(12).reduce((s, m) => s + delhi.cdd[m], 0);
  let total = 0;
  for (const loc of LOCALITIES) total += await fillLocality(loc, delhiYear);
  const out = await runAreaJob();
  const mohallas = await db.mohalla.count();
  console.log(`🏘️  ${total} homes across ${LOCALITIES.length} localities → ${mohallas} mohallas; ${out.areas} area totals`);
}

if (process.argv[1]?.includes("realMohallas")) {
  seedRealMohallas()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
