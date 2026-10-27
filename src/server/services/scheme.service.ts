import { db } from "@/server/db";
import { stateCode } from "@/lib/carbonId";
import { type CarbonStatus } from "@/lib/allowance";
import { homeStatus } from "./allowance.service";
import { COUNTER_SCHEMES, LAST_CHECKED, SCHEME_CATALOGUE } from "@/server/schemes/catalogue";
import { notifyHousehold } from "./notify.service";

/*
 * Sarkari Yojana: which government schemes a home can use, and the shop counter as the bridge to them.
 * We match on facts we already hold (state, electricity company from the bills, what the home owns, whether it
 * owns the house) and explain the benefit; the claim always happens on the official portal or at the dealer.
 */

export class SchemeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Adds catalogue entries that aren't in the table yet. Never overwrites an admin's edits. */
export async function ensureSchemes() {
  const have = new Set((await db.scheme.findMany({ select: { slug: true } })).map((s) => s.slug));
  for (const s of SCHEME_CATALOGUE) {
    if (have.has(s.slug)) continue;
    await db.scheme.create({
      data: {
        slug: s.slug,
        category: s.category,
        name: s.name,
        nameHi: s.nameHi,
        summary: s.summary,
        summaryHi: s.summaryHi,
        benefit: s.benefit,
        benefitHi: s.benefitHi,
        whoQualifies: s.whoQualifies,
        steps: JSON.stringify(s.steps),
        documents: s.documents ? JSON.stringify(s.documents) : null,
        link: s.link,
        helpline: s.helpline ?? null,
        states: s.states ?? "ALL",
        discoms: s.discoms ?? null,
        validUntil: s.validUntil ? new Date(`${s.validUntil}T23:59:59+05:30`) : null,
        lastChecked: new Date(`${LAST_CHECKED}T00:00:00+05:30`),
        sourceUrl: s.sourceUrl,
        status: s.status ?? "ACTIVE",
      },
    });
  }
}

type SchemeRow = Awaited<ReturnType<typeof db.scheme.findMany>>[number];

export function publicScheme(s: SchemeRow) {
  return {
    slug: s.slug,
    category: s.category,
    name: s.name,
    nameHi: s.nameHi,
    summary: s.summary,
    summaryHi: s.summaryHi,
    benefit: s.benefit,
    benefitHi: s.benefitHi,
    whoQualifies: s.whoQualifies,
    steps: safeList(s.steps),
    documents: safeList(s.documents),
    link: s.link,
    helpline: s.helpline,
    states: s.states,
    validUntil: s.validUntil?.toISOString() ?? null,
    lastChecked: s.lastChecked.toISOString(),
    sourceUrl: s.sourceUrl,
    status: s.status,
  };
}

function safeList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

const inState = (s: SchemeRow, state: string) => s.states === "ALL" || s.states.split(",").map((x) => x.trim()).includes(state);
const GOOD_RATINGS = new Set(["5_STAR", "5_STAR_INVERTER", "4_STAR"]);
const RATING_WORDS: Record<string, [string, string]> = {
  "3_STAR": ["3-star", "3-स्टार"],
  "2_STAR": ["2-star", "2-स्टार"],
  "1_STAR": ["1-star", "1-स्टार"],
  NON_INVERTER: ["non-inverter", "नॉन-इन्वर्टर"],
  UNRATED: ["without a star label", "बिना स्टार लेबल"],
  INVERTER: ["inverter without stars", "बिना स्टार वाला इन्वर्टर"],
};

type Ctx = {
  state: string;
  ownsHome: boolean | null;
  discoms: string[];
  avgMonthlyKwh: number | null;
  appliances: { type: string; rating: string; name: string | null }[];
  vehicles: { type: string; fuel: string; year: number | null; name: string | null }[];
};

export type Match = { reason: string; reasonHi: string; estimateInr?: number };

/** Why this home can use this scheme, or null. Pure: easy to test, same rules on web, Android and the counter. */
export function matchScheme(slug: string, ctx: Ctx, today = new Date()): Match | null {
  const year = today.getFullYear();
  switch (slug) {
    case "pm-surya-ghar": {
      if (ctx.appliances.some((a) => a.type === "SolarPV") || ctx.ownsHome === false) return null;
      const kw = ctx.avgMonthlyKwh ? Math.min(3, Math.max(1, Math.round(ctx.avgMonthlyKwh / 120))) : 2;
      const subsidy = kw === 1 ? 30000 : kw === 2 ? 60000 : 78000;
      const own = ctx.ownsHome === null ? " (if the house is yours)" : "";
      const ownHi = ctx.ownsHome === null ? " (अगर घर आपका है)" : "";
      return ctx.avgMonthlyKwh
        ? {
            reason: `Your bills show about ${Math.round(ctx.avgMonthlyKwh)} units a month. A ${kw} kW rooftop system could cover much of it, with a subsidy of ₹${subsidy.toLocaleString("en-IN")}${own}.`,
            reasonHi: `आपके बिल में हर महीने लगभग ${Math.round(ctx.avgMonthlyKwh)} यूनिट हैं। ${kw} किलोवाट का सोलर इसका बड़ा हिस्सा दे सकता है, ₹${subsidy.toLocaleString("en-IN")} सब्सिडी के साथ${ownHi}।`,
            estimateInr: subsidy,
          }
        : {
            reason: `You don't have rooftop solar yet${own}.`,
            reasonHi: `आपके घर पर अभी सोलर नहीं है${ownHi}।`,
            estimateInr: subsidy,
          };
    }
    case "pm-e-drive": {
      const v = ctx.vehicles.find((x) => x.type === "TwoWheeler" && x.fuel === "Petrol");
      if (!v) return null;
      return {
        reason: `Your petrol two-wheeler${v.name ? ` (${v.name})` : ""} could be replaced by an electric one, with up to ₹5,000 off at the dealer.`,
        reasonHi: `आपका पेट्रोल दोपहिया${v.name ? ` (${v.name})` : ""} इलेक्ट्रिक से बदला जा सकता है, डीलर पर ₹5,000 तक छूट।`,
        estimateInr: 5000,
      };
    }
    case "vehicle-scrappage": {
      const old = ctx.vehicles.find((v) => v.year && v.type !== "PublicTransit" && (year - v.year >= 15 || (v.fuel === "Diesel" && year - v.year >= 10)));
      if (!old || !old.year) return null;
      const age = year - old.year;
      return {
        reason: `Your ${old.name ?? old.type.toLowerCase()} is ${age} years old (${old.year}). Scrapping it at a registered centre can cut the road tax on your next vehicle by up to 25%.`,
        reasonHi: `आपकी ${old.name ?? "गाड़ी"} ${age} साल पुरानी है (${old.year})। मान्य केंद्र पर स्क्रैप करने से अगली गाड़ी के रोड टैक्स में 25% तक छूट मिल सकती है।`,
      };
    }
    case "tpddl-ac-replacement": {
      if (ctx.state !== "DL") return null;
      const tp = /tata|tpddl|ndpl/i;
      if (ctx.discoms.length && !ctx.discoms.some((d) => tp.test(d))) return null;
      const ac = ctx.appliances.find((a) => a.type === "AC" && !GOOD_RATINGS.has(a.rating));
      if (!ac) return null;
      const [en, hi] = RATING_WORDS[ac.rating] ?? [ac.rating, ac.rating];
      const maybe = ctx.discoms.length ? "" : " if your electricity company is Tata Power-DDL";
      const maybeHi = ctx.discoms.length ? "" : " अगर आपकी बिजली कंपनी टाटा पावर-डीडीएल है";
      return {
        reason: `Your ${ac.name ?? "AC"} is ${en}. You can swap it for an efficient AC at up to 53% off${maybe}.`,
        reasonHi: `आपका ${ac.name ?? "एसी"} ${hi} है। आप इसे 53% तक छूट पर कुशल एसी से बदल सकते हैं${maybeHi}।`,
      };
    }
    default:
      return null;
  }
}

async function contextFor(householdId: string): Promise<{ ctx: Ctx; household: { state: string; size: number } }> {
  const h = await db.household.findUnique({
    where: { id: householdId },
    select: {
      state: true,
      size: true,
      ownsHome: true,
      appliances: { select: { type: true, rating: true, name: true } },
      vehicles: { select: { type: true, fuel: true, year: true, name: true } },
      bills: { orderBy: { periodEnd: "desc" }, take: 3, select: { kwh: true, periodStart: true, periodEnd: true, discom: true } },
    },
  });
  if (!h) throw new SchemeError("Household not found", 404);
  const days = h.bills.reduce((a, b) => a + Math.max(1, (b.periodEnd.getTime() - b.periodStart.getTime()) / 86_400_000), 0);
  const kwh = h.bills.reduce((a, b) => a + b.kwh, 0);
  return {
    household: { state: h.state, size: h.size },
    ctx: {
      state: stateCode(h.state),
      ownsHome: h.ownsHome,
      discoms: [...new Set(h.bills.map((b) => b.discom).filter((d): d is string => !!d))],
      avgMonthlyKwh: days > 0 ? (kwh / days) * 30 : null,
      appliances: h.appliances,
      vehicles: h.vehicles,
    },
  };
}

/** The Sarkari Yojana page: schemes for this home (with the reason), every scheme in its state, and what it applied for. */
export async function schemesForHousehold(householdId: string) {
  await ensureSchemes();
  const [{ ctx }, rows, help] = await Promise.all([
    contextFor(householdId),
    db.scheme.findMany({ where: { status: { not: "HIDDEN" } }, orderBy: { name: "asc" } }),
    db.schemeHelp.findMany({
      where: { householdId },
      orderBy: { createdAt: "desc" },
      include: { scheme: { select: { slug: true } }, merchant: { select: { businessName: true } } },
    }),
  ]);
  const all = rows.filter((s) => inState(s, ctx.state));
  const forYou = all
    .map((s) => ({ s, m: matchScheme(s.slug, ctx) }))
    .filter((x): x is { s: SchemeRow; m: Match } => !!x.m)
    .sort((a, b) => (b.m.estimateInr ?? 0) - (a.m.estimateInr ?? 0))
    .map(({ s, m }) => ({ ...publicScheme(s), ...m }));
  return {
    state: ctx.state,
    ownsHome: ctx.ownsHome,
    forYou,
    all: all.map(publicScheme),
    help: help.map((h) => ({ slug: h.scheme.slug, status: h.status, shop: h.merchant?.businessName ?? null, at: h.createdAt.toISOString() })),
  };
}

export async function markApplied(householdId: string, slug: string) {
  const scheme = await db.scheme.findUnique({ where: { slug } });
  if (!scheme || scheme.status === "HIDDEN") throw new SchemeError("Scheme not found", 404);
  const existing = await db.schemeHelp.findFirst({ where: { householdId, schemeId: scheme.id, status: "APPLIED", merchantId: null } });
  if (existing) return existing;
  return db.schemeHelp.create({ data: { householdId, schemeId: scheme.id, status: "APPLIED" } });
}

const COUNTER_SENTENCE: Record<CarbonStatus, string> = {
  GREEN: "This home is below its state's average. Any efficient model keeps it there.",
  AMBER: "This home is close to its state's average. Suggest the most efficient model: 5-star, inverter or electric.",
  RED: "This home is above its state's average. Suggest a 5-star inverter or electric model, and the benefits below.",
};

/**
 * What the shop sees after a scan: a colour with one sentence (never the home's numbers) and the schemes
 * that fit what this shop sells, flagged when the home's own items make it a clear match.
 */
export async function counterAdvice(householdId: string, sells: string) {
  await ensureSchemes();
  const [{ ctx, household }, latest] = await Promise.all([
    contextFor(householdId),
    db.monthlySummary.findFirst({ where: { householdId, totalKg: { gt: 0 } }, orderBy: { month: "desc" }, select: { totalKg: true, month: true } }),
  ]);
  const status = latest ? (await homeStatus(household.state, household.size, latest.totalKg, latest.month)).status : null;
  const slugs = [
    ...(sells === "VEHICLES" ? [] : COUNTER_SCHEMES.APPLIANCES),
    ...(sells === "APPLIANCES" ? [] : COUNTER_SCHEMES.VEHICLES),
  ];
  const rows = await db.scheme.findMany({ where: { slug: { in: slugs }, status: { not: "HIDDEN" } } });
  const benefits = rows
    .filter((s) => inState(s, ctx.state))
    .map((s) => {
      const m = matchScheme(s.slug, ctx);
      return { slug: s.slug, name: s.name, benefit: s.benefit, link: s.link, helpline: s.helpline, status: s.status, matched: !!m, why: m?.reason ?? null };
    })
    .sort((a, b) => Number(b.matched) - Number(a.matched));
  return {
    status: status ? { colour: status, sentence: COUNTER_SENTENCE[status] } : { colour: null, sentence: "No bills yet for this home, so there's no colour. Suggest the most efficient model." },
    benefits,
  };
}

/** The shop explained a scheme or helped apply; the home gets a notification with the official link. */
export async function recordCounterHelp(householdId: string, merchantId: string, shop: string, slug: string, status: "EXPLAINED" | "APPLIED") {
  const scheme = await db.scheme.findUnique({ where: { slug } });
  if (!scheme || scheme.status === "HIDDEN") throw new SchemeError("Scheme not found", 404);
  const row = await db.schemeHelp.create({ data: { householdId, schemeId: scheme.id, merchantId, status } });
  await notifyHousehold(householdId, {
    title: status === "APPLIED" ? `Applied: ${scheme.name}` : `A scheme for you: ${scheme.name}`,
    body: `${shop} ${status === "APPLIED" ? "helped you apply" : "told you about it"}. ${scheme.benefit} Steps and the official link are in Govt schemes.`,
    url: "/yojana",
    tag: `scheme:${row.id}`,
  });
  return row;
}
