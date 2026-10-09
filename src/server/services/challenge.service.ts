import { db } from "@/server/db";

export interface ChallengeItem {
  id: string;
  householdId: string;
  template: string;
  title: string;
  description: string;
  category: string;
  progress: number; // 0 to 100
  targetDays: number;
  currentDays: number;
  kgSaved: number;
  inrSaved: number;
  streak: number;
  status: string;
}

const DEFAULT_TEMPLATES = [
  {
    template: "summer_cooling_24c",
    title: "Summer Peak Cooling 24°C Challenge",
    description: "Maintain AC thermostat at or above 24°C during evening peak hours.",
    category: "Electricity",
    targetDays: 14,
    defaultStreak: 8,
    kgPerDay: 1.8,
    inrPerDay: 50,
  },
  {
    template: "phantom_power_zero",
    title: "Zero Phantom Power Sprint",
    description: "Power down desktop workstations and standby inverter loads overnight.",
    category: "Electricity",
    targetDays: 14,
    defaultStreak: 12,
    kgPerDay: 0.9,
    inrPerDay: 28,
  },
  {
    template: "clean_commute_transit",
    title: "Clean Commute Transit Shift",
    description: "Substitute private combustion vehicle trips with urban metro or EV transit.",
    category: "Transport",
    targetDays: 7,
    defaultStreak: 4,
    kgPerDay: 3.5,
    inrPerDay: 110,
  },
  {
    template: "solar_peak_optimization",
    title: "Solar Peak Hours Load Matching",
    description: "Run washing machines and heavy thermal cycles during noon solar generation.",
    category: "Renewables",
    targetDays: 10,
    defaultStreak: 3,
    kgPerDay: 2.2,
    inrPerDay: 65,
  },
];

export class ChallengeService {
  /**
   * List or auto-initialize challenges for a household.
   */
  async listChallenges(householdId: string): Promise<ChallengeItem[]> {
    let records = await db.challenge.findMany({
      where: { householdId },
      orderBy: { createdAt: "asc" },
    });

    if (records.length === 0) {
      // Auto-initialize default challenges for the household
      for (const t of DEFAULT_TEMPLATES) {
        const streak = t.defaultStreak;
        const currentDays = streak;
        const progress = Math.min(100, Math.round((currentDays / t.targetDays) * 100));
        const kgSaved = Number((currentDays * t.kgPerDay).toFixed(1));
        const inrSaved = Math.round(currentDays * t.inrPerDay);

        await db.challenge.create({
          data: {
            householdId,
            template: t.template,
            progress,
            streak,
            kgSaved,
            inrSaved,
            status: "ACTIVE",
          },
        });
      }

      records = await db.challenge.findMany({
        where: { householdId },
        orderBy: { createdAt: "asc" },
      });
    }

    return records.map((r) => {
      const tmpl = DEFAULT_TEMPLATES.find((t) => t.template === r.template) || {
        title: r.template.replace(/_/g, " "),
        description: "Household climate challenge action item.",
        category: "General",
        targetDays: 14,
        kgPerDay: 1.5,
        inrPerDay: 40,
      };

      const currentDays = Math.round((r.progress / 100) * tmpl.targetDays);

      return {
        id: r.id,
        householdId: r.householdId,
        template: r.template,
        title: tmpl.title,
        description: tmpl.description,
        category: tmpl.category,
        progress: r.progress,
        targetDays: tmpl.targetDays,
        currentDays,
        kgSaved: r.kgSaved,
        inrSaved: r.inrSaved,
        streak: r.streak,
        status: r.status,
      };
    });
  }

  /**
   * Increment progress and streak on a challenge.
   */
  async updateProgress(householdId: string, challengeId: string, incrementDays: number = 1): Promise<ChallengeItem> {
    const existing = await db.challenge.findFirst({
      where: { id: challengeId, householdId },
    });

    if (!existing) {
      throw new Error(`Challenge ${challengeId} not found for household ${householdId}`);
    }

    const tmpl = DEFAULT_TEMPLATES.find((t) => t.template === existing.template) || {
      targetDays: 14,
      kgPerDay: 1.5,
      inrPerDay: 40,
      title: "Challenge",
      description: "",
      category: "General",
    };

    const newStreak = existing.streak + incrementDays;
    const currentDays = Math.min(tmpl.targetDays, Math.round((existing.progress / 100) * tmpl.targetDays) + incrementDays);
    const newProgress = Math.min(100, Math.round((currentDays / tmpl.targetDays) * 100));
    const newKg = Number((currentDays * tmpl.kgPerDay).toFixed(1));
    const newInr = Math.round(currentDays * tmpl.inrPerDay);
    const newStatus = newProgress >= 100 ? "COMPLETED" : "ACTIVE";

    const updated = await db.challenge.update({
      where: { id: existing.id },
      data: {
        streak: newStreak,
        progress: newProgress,
        kgSaved: newKg,
        inrSaved: newInr,
        status: newStatus,
      },
    });

    return {
      id: updated.id,
      householdId: updated.householdId,
      template: updated.template,
      title: tmpl.title,
      description: tmpl.description,
      category: tmpl.category,
      progress: updated.progress,
      targetDays: tmpl.targetDays,
      currentDays,
      kgSaved: updated.kgSaved,
      inrSaved: updated.inrSaved,
      streak: updated.streak,
      status: updated.status,
    };
  }
}

export const challengeService = new ChallengeService();
