import { db } from "@/server/db";

/**
 * Challenges: small daily habits with a streak, points and badges.
 *
 * Every kg figure is estimated from this home's own data (measured or rated AC power, the AC hours on its
 * latest bill, its car's fuel and mileage, its tariff) and shown with the arithmetic. A challenge only
 * appears if the home has what it needs (no car → no car-free day). One check-in per day, India time.
 */

const GRID_EF = 0.675; // kg CO2 per kWh, CEA 2025-26
const FUEL_EF: Record<string, number> = { Petrol: 2.31, Diesel: 2.68, CNG: 2.75, Hybrid: 2.31 };
const METRO_KG_PER_KM = 0.025; // Delhi Metro, TERI
const SETPOINT_SAVING = 0.12; // 22 → 24 °C ≈ 2 × 6% less cooling energy (BEE)
const STANDBY_KW = 0.04; // ~40 W of TVs, set-top boxes and chargers left on standby (typical Indian home)
const DEFAULT_TARIFF = 7;

export class ChallengeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Ctx = {
  acKw: number | null;
  acKwSource: string;
  acHours: number | null;
  geyserKw: number | null;
  car: { name: string; fuel: string; monthlyKm: number; kmPerUnit: number } | null;
  tariff: number;
};

type Saving = { kgPerDay: number; inrPerDay: number; math: string };

type Def = {
  template: string;
  title: string;
  blurb: string;
  category: "Electricity" | "Transport";
  targetDays: number;
  saving: (c: Ctx) => Saving | null;
};

const kwhSaving = (kwh: number, c: Ctx, math: string): Saving => ({
  kgPerDay: Math.round(kwh * GRID_EF * 100) / 100,
  inrPerDay: Math.round(kwh * c.tariff * 10) / 10,
  math: `${math} = ${kwh.toFixed(2)} kWh × 0.675 kg`,
});

export const CATALOG: Def[] = [
  {
    template: "ac_24",
    title: "Cool at 24 °C",
    blurb: "Keep the AC at 24 °C or warmer all day. Ceiling fan on for the breeze.",
    category: "Electricity",
    targetDays: 14,
    saving: (c) =>
      c.acKw && c.acHours ? kwhSaving(c.acKw * c.acHours * SETPOINT_SAVING, c, `${c.acKw} kW × ${c.acHours} h × 12%`) : null,
  },
  {
    template: "ac_hour_less",
    title: "One hour less AC",
    blurb: "Set the AC's sleep timer to switch off an hour before you wake up.",
    category: "Electricity",
    targetDays: 14,
    saving: (c) => (c.acKw ? kwhSaving(c.acKw * 1, c, `${c.acKw} kW × 1 h`) : null),
  },
  {
    template: "standby_off",
    title: "Switch-off night",
    blurb: "Before bed, switch off the TV, set-top box and chargers at the plug.",
    category: "Electricity",
    targetDays: 21,
    saving: (c) => kwhSaving(STANDBY_KW * 8, c, "≈40 W standby × 8 h"),
  },
  {
    template: "geyser_short",
    title: "Quick-shower geyser",
    blurb: "Switch the geyser on 15 minutes before your bath, not 45.",
    category: "Electricity",
    targetDays: 14,
    saving: (c) => (c.geyserKw ? kwhSaving(c.geyserKw * 0.5, c, `${c.geyserKw} kW × 0.5 h`) : null),
  },
  {
    template: "car_free_day",
    title: "Car-free day",
    blurb: "Take the metro, bus, a cycle or walk instead of the car for a whole day.",
    category: "Transport",
    targetDays: 7,
    saving: (c) => {
      if (!c.car) return null;
      const km = c.car.monthlyKm / 30;
      const carPerKm = (FUEL_EF[c.car.fuel] ?? 2.31) / c.car.kmPerUnit;
      const kg = km * (carPerKm - METRO_KG_PER_KM);
      const fuelInr = (km / c.car.kmPerUnit) * 100 - km * 2; // ~₹100/L fuel vs ~₹2/km metro
      return {
        kgPerDay: Math.round(kg * 100) / 100,
        inrPerDay: Math.round(fuelInr),
        math: `${km.toFixed(1)} km × (${carPerKm.toFixed(3)} − ${METRO_KG_PER_KM}) kg per km`,
      };
    },
  },
];

// Points and levels
const XP_PER_DAY = 10;
const XP_STREAK_BONUS = 5; // per check-in once a streak reaches 3 days
const XP_FINISH = 50;
const LEVELS = [
  [0, "Seedling"],
  [100, "Sapling"],
  [250, "Young tree"],
  [500, "Tree"],
  [1000, "Forest"],
  [2000, "Rainforest"],
] as const;

const BADGES = [
  { id: "first_step", name: "First step", desc: "Your first check-in" },
  { id: "on_a_roll", name: "On a roll", desc: "A 3-day streak" },
  { id: "week_warrior", name: "Week warrior", desc: "A 7-day streak" },
  { id: "finisher", name: "Finisher", desc: "Complete any challenge" },
  { id: "cool_head", name: "Cool head", desc: "Complete “Cool at 24 °C”" },
  { id: "car_free", name: "Car-free champ", desc: "Complete “Car-free day”" },
  { id: "ten_kg", name: "10 kg club", desc: "Save 10 kg in challenges" },
] as const;

/** India date, e.g. "2026-10-10" */
function istDay(d: Date) {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

async function context(householdId: string): Promise<Ctx> {
  const [cal, appliances, vehicles, bills] = await Promise.all([
    db.calibration.findFirst({ where: { householdId, method: { not: "default" } }, orderBy: { createdAt: "desc" } }),
    db.appliance.findMany({ where: { householdId } }),
    db.vehicle.findMany({ where: { householdId } }),
    db.bill.findMany({ where: { householdId }, orderBy: { periodStart: "desc" } }),
  ]);
  const ac = appliances.filter((a) => a.type === "AC").sort((a, b) => b.powerKw - a.powerKw)[0];
  const geyser = appliances.find((a) => a.type === "WaterHeater" || a.type === "Geyser");
  const car = vehicles.find((v) => FUEL_EF[v.fuel] !== undefined && v.monthlyKm > 0 && v.kmPerUnit > 0);
  const priced = bills.filter((b) => b.amountInr && b.amountInr > 0);
  const pricedKwh = priced.reduce((s, b) => s + b.kwh, 0);
  return {
    acKw: cal ? Math.round(cal.acKw * 100) / 100 : ac?.powerKw ?? null,
    acKwSource: cal ? "measured from your bills" : "rated",
    acHours: bills.find((b) => b.acHoursPerDay > 0)?.acHoursPerDay ?? ac?.avgHoursPerDay ?? null,
    geyserKw: geyser?.powerKw ?? null,
    car: car ? { name: car.name ?? car.type, fuel: car.fuel, monthlyKm: car.monthlyKm, kmPerUnit: car.kmPerUnit } : null,
    tariff: pricedKwh > 0 ? priced.reduce((s, b) => s + (b.amountInr ?? 0), 0) / pricedKwh : DEFAULT_TARIFF,
  };
}

export type ChallengeView = {
  id: string | null;
  template: string;
  title: string;
  blurb: string;
  category: string;
  targetDays: number;
  daysDone: number;
  streak: number;
  progress: number; // 0..100
  kgPerDay: number;
  inrPerDay: number;
  math: string;
  kgSaved: number;
  inrSaved: number;
  status: "AVAILABLE" | "ACTIVE" | "COMPLETED";
  checkedInToday: boolean;
};

export type Player = {
  xp: number;
  level: number;
  levelName: string;
  levelFloor: number;
  nextLevelXp: number | null;
  nextLevelName: string | null;
  totalKg: number;
  totalInr: number;
  badges: { id: string; name: string; desc: string; earned: boolean }[];
};

export class ChallengeService {
  async list(householdId: string): Promise<{ challenges: ChallengeView[]; player: Player }> {
    const ctx = await context(householdId);
    // Rows from the old demo catalog had made-up progress: drop them
    await db.challenge.deleteMany({ where: { householdId, template: { notIn: CATALOG.map((d) => d.template) } } });
    const rows = await db.challenge.findMany({ where: { householdId } });
    const today = istDay(new Date());
    const yesterday = istDay(new Date(Date.now() - 86_400_000));

    const challenges: ChallengeView[] = [];
    for (const def of CATALOG) {
      const s = def.saving(ctx);
      if (!s) continue;
      const r = rows.find((x) => x.template === def.template);
      const last = r?.lastCheckIn ? istDay(r.lastCheckIn) : null;
      // A streak survives only if the last check-in was today or yesterday
      const streak = r && (last === today || last === yesterday) ? r.streak : 0;
      challenges.push({
        id: r?.id ?? null,
        template: def.template,
        title: def.title,
        blurb: def.blurb,
        category: def.category,
        targetDays: def.targetDays,
        daysDone: r?.daysDone ?? 0,
        streak,
        progress: r ? Math.min(100, Math.round((r.daysDone / def.targetDays) * 100)) : 0,
        kgPerDay: s.kgPerDay,
        inrPerDay: s.inrPerDay,
        math: s.math,
        kgSaved: Math.round((r?.daysDone ?? 0) * s.kgPerDay * 10) / 10,
        inrSaved: Math.round((r?.daysDone ?? 0) * s.inrPerDay),
        status: !r ? "AVAILABLE" : r.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
        checkedInToday: last === today,
      });
    }
    return { challenges, player: this.player(challenges, rows.map((r) => r.streak)) };
  }

  private player(cs: ChallengeView[], storedStreaks: number[]): Player {
    let xp = 0;
    for (const c of cs) {
      xp += c.daysDone * XP_PER_DAY + Math.max(0, c.daysDone - 2) * XP_STREAK_BONUS * (c.streak >= 3 ? 1 : 0);
      if (c.status === "COMPLETED") xp += XP_FINISH;
    }
    let li = 0;
    LEVELS.forEach(([floor], i) => {
      if (xp >= floor) li = i;
    });
    const bestStreak = Math.max(0, ...storedStreaks);
    const totalKg = Math.round(cs.reduce((s, c) => s + c.kgSaved, 0) * 10) / 10;
    const done = (t: string) => cs.some((c) => c.template === t && c.status === "COMPLETED");
    const earned: Record<string, boolean> = {
      first_step: cs.some((c) => c.daysDone > 0),
      on_a_roll: bestStreak >= 3,
      week_warrior: bestStreak >= 7,
      finisher: cs.some((c) => c.status === "COMPLETED"),
      cool_head: done("ac_24"),
      car_free: done("car_free_day"),
      ten_kg: totalKg >= 10,
    };
    return {
      xp,
      level: li + 1,
      levelName: LEVELS[li][1],
      levelFloor: LEVELS[li][0],
      nextLevelXp: LEVELS[li + 1]?.[0] ?? null,
      nextLevelName: LEVELS[li + 1]?.[1] ?? null,
      totalKg,
      totalInr: cs.reduce((s, c) => s + c.inrSaved, 0),
      badges: BADGES.map((b) => ({ ...b, earned: earned[b.id] })),
    };
  }

  async join(householdId: string, template: string) {
    if (!CATALOG.some((d) => d.template === template)) throw new ChallengeError("Unknown challenge", 404);
    await db.challenge.upsert({
      where: { householdId_template: { householdId, template } },
      create: { householdId, template, kgSaved: 0, inrSaved: 0, status: "ACTIVE" },
      update: {},
    });
    return this.list(householdId);
  }

  async leave(householdId: string, template: string) {
    await db.challenge.deleteMany({ where: { householdId, template } });
    return this.list(householdId);
  }

  async checkIn(householdId: string, template: string) {
    const def = CATALOG.find((d) => d.template === template);
    if (!def) throw new ChallengeError("Unknown challenge", 404);
    const row = await db.challenge.findUnique({ where: { householdId_template: { householdId, template } } });
    if (!row) throw new ChallengeError("Join the challenge first.", 409);
    if (row.status === "COMPLETED") throw new ChallengeError("Already completed. Nice!", 409);
    const now = new Date();
    const today = istDay(now);
    const last = row.lastCheckIn ? istDay(row.lastCheckIn) : null;
    if (last === today) throw new ChallengeError("Already checked in today. Come back tomorrow!", 409);
    const streak = last === istDay(new Date(now.getTime() - 86_400_000)) ? row.streak + 1 : 1;
    const daysDone = row.daysDone + 1;
    const s = def.saving(await context(householdId));
    await db.challenge.update({
      where: { id: row.id },
      data: {
        daysDone,
        streak,
        lastCheckIn: now,
        progress: Math.min(100, Math.round((daysDone / def.targetDays) * 100)),
        kgSaved: Math.round(daysDone * (s?.kgPerDay ?? 0) * 10) / 10,
        inrSaved: Math.round(daysDone * (s?.inrPerDay ?? 0)),
        status: daysDone >= def.targetDays ? "COMPLETED" : "ACTIVE",
      },
    });
    return this.list(householdId);
  }
}

export const challengeService = new ChallengeService();
