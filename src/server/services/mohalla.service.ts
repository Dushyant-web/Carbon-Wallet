import { cellToBoundary, cellToLatLng, cellToParent, cellsToMultiPolygon, latLngToCell } from "h3-js";
import { z } from "zod";
import { db } from "@/server/db";
import { stateCode } from "@/lib/carbonId";
import { GRID_KG_PER_KWH, stateInfo, statusFor } from "@/lib/allowance";
import { monthlyKg, officialFor } from "@/lib/officialData";
import { heatLevel, weatherFor, type Weather } from "./weather.service";
import { resolveReportingPeriod } from "@/server/period";

/*
 * Mohalla → city → state → India.
 *
 *   location   GPS or a pin the owner drops by hand → only H3 hexagons are kept (resolution 10 ≈ 120 m across,
 *              resolution 7 ≈ 5 km² for weather and grouping), never the point itself.
 *   mohallas   homes in the same resolution-7 area, in H3 order (neighbours sit together), cut into groups of
 *              about 40. Codes are "<area>-<n>", so a mohalla keeps its id between runs.
 *   area stats kg per person per month for each mohalla, city, state and India, precomputed; an area with fewer
 *              than MOHALLA_MIN_HOMES homes (default 20) shows no numbers, so no single home can be picked out.
 */

export const TARGET_HOMES = 40;
export const SPLIT_ABOVE = 80;
export const minHomes = () => Math.max(1, Number(process.env.MOHALLA_MIN_HOMES ?? 20) || 20);

export class LocationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// India's bounding box, generously: a pin outside it is a mistake
export const LocationInput = z.object({
  lat: z.number().min(6).max(37.5),
  lng: z.number().min(68).max(97.5),
  source: z.enum(["GPS", "MANUAL"]),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional(),
  locality: z.string().trim().max(80).optional(),
  district: z.string().trim().max(60).optional(),
});

export async function setLocation(householdId: string, userId: string, body: unknown) {
  const parsed = LocationInput.safeParse(body);
  if (!parsed.success) throw new LocationError("That place is outside India or incomplete. Drop the pin on your home.", 400);
  const { lat, lng, source, pincode, locality, district } = parsed.data;
  const h3Cell = latLngToCell(lat, lng, 10);
  const h3Area = cellToParent(h3Cell, 7);
  const household = await db.household.findUnique({ where: { id: householdId }, select: { state: true, city: true, location: true } });
  if (!household) throw new LocationError("Household not found", 404);
  const before = household.location ? groupKey(household.location, household.city) : null;
  const data = {
    h3Cell,
    h3Area,
    pincode: pincode ?? null,
    locality: locality ?? null,
    district: district ?? null,
    state: stateCode(household.state),
    source,
    consentAt: new Date(),
  };
  await db.householdLocation.upsert({ where: { householdId }, create: { householdId, ...data }, update: { ...data, mohallaId: null } });
  await db.auditLog.create({
    data: { householdId, userId, action: "location.set", entity: "Household", details: `${source.toLowerCase()} · area ${h3Area}${pincode ? ` · ${pincode}` : ""}` },
  });
  const after = groupKey({ locality: data.locality, h3Area }, household.city);
  await formMohallas(after);
  if (before && before !== after) await formMohallas(before); // the mohalla it left
  return { h3Area };
}

const slug = (x: string) => x.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** A home's group: its named locality in its city (from the pincode list or the owner), else its H3 area. */
export function groupKey(l: { locality: string | null; h3Area: string }, city: string) {
  return l.locality ? `loc:${slug(city)}:${slug(l.locality)}` : `h3:${l.h3Area}`;
}

/**
 * Groups homes into mohallas: all homes of one locality (e.g. Knowledge Park II) or, without a locality, of one
 * H3 area; in H3 order so neighbours sit together; split into groups of about 40 above 80 homes.
 * With `onlyGroup`, only that group is redone (after one home moves); otherwise everything (the nightly job).
 */
export async function formMohallas(onlyGroup?: string) {
  const locs = await db.householdLocation.findMany({
    where: { household: { status: "ACTIVE" } },
    include: { household: { select: { city: true, state: true } } },
  });
  const groups = new Map<string, typeof locs>();
  for (const l of locs) {
    const k = groupKey(l, l.household.city);
    if (!onlyGroup || k === onlyGroup) groups.set(k, [...(groups.get(k) ?? []), l]);
  }

  const keep: string[] = [];
  for (const [key, homes] of groups) {
    homes.sort((a, b) => (a.h3Cell < b.h3Cell ? -1 : a.h3Cell > b.h3Cell ? 1 : 0));
    const n = homes.length <= SPLIT_ABOVE ? 1 : Math.round(homes.length / TARGET_HOMES);
    const size = Math.ceil(homes.length / n);
    for (let g = 0; g < n; g++) {
      const members = homes.slice(g * size, (g + 1) * size);
      if (!members.length) continue;
      const first = members[0];
      const place = mostCommon(members.map((m) => m.locality).filter(Boolean) as string[]) ?? mostCommon(members.map((m) => m.district).filter(Boolean) as string[]);
      const name = [first.household.city, place, n > 1 || !place ? `Mohalla ${g + 1}` : null].filter(Boolean).join(" · ");
      const code = `${key}#${g + 1}`;
      keep.push(code);
      const area = mostCommon(members.map((m) => m.h3Area))!; // weather comes from where most of the homes are
      const m = await db.mohalla.upsert({
        where: { code },
        create: { code, name, city: first.household.city, state: stateCode(first.household.state), h3Area: area, homes: members.length },
        update: { name, h3Area: area, homes: members.length },
      });
      await db.householdLocation.updateMany({ where: { householdId: { in: members.map((x) => x.householdId) } }, data: { mohallaId: m.id } });
    }
  }
  // mohallas that no longer have homes (or, for one group, its old splits)
  await db.mohalla.deleteMany({
    where: onlyGroup ? { code: { startsWith: `${onlyGroup}#`, notIn: keep } } : { code: { notIn: keep } },
  });
}

function mostCommon(xs: string[]) {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

type Agg = { homes: number; people: number; kg: number; byCat: Record<string, number> };

/** Monthly kg per person for every mohalla, city, state and India. Only ACTIVE homes with data that month count. */
export async function computeAreaStats(month: string) {
  const rows = await db.monthlySummary.findMany({
    where: { month, totalKg: { gt: 0 }, household: { status: "ACTIVE" } },
    select: { totalKg: true, byCategory: true, household: { select: { size: true, city: true, state: true, location: { select: { mohallaId: true } } } } },
  });
  const buckets = new Map<string, Agg>();
  const add = (level: string, key: string, r: (typeof rows)[number]) => {
    const k = `${level}\u0000${key}`;
    const a = buckets.get(k) ?? { homes: 0, people: 0, kg: 0, byCat: {} };
    a.homes += 1;
    a.people += Math.max(1, r.household.size);
    a.kg += r.totalKg;
    try {
      for (const [cat, kg] of Object.entries(JSON.parse(r.byCategory) as Record<string, number>)) a.byCat[cat] = (a.byCat[cat] ?? 0) + kg;
    } catch {
      /* summary without a breakdown */
    }
    buckets.set(k, a);
  };
  for (const r of rows) {
    const st = stateCode(r.household.state);
    add("INDIA", "IN", r);
    add("STATE", st, r);
    add("CITY", `${r.household.city}|${st}`, r);
    if (r.household.location?.mohallaId) add("MOHALLA", r.household.location.mohallaId, r);
  }
  // a month is recomputed whole, so areas that no longer have homes that month disappear
  await db.areaStat.deleteMany({ where: { month, ...(buckets.size ? { NOT: { OR: [...buckets.keys()].map((k) => ({ level: k.split("\u0000")[0], key: k.split("\u0000")[1] })) } } : {}) } });
  for (const [k, a] of buckets) {
    const [level, key] = k.split("\u0000");
    const perPerson = Object.fromEntries(Object.entries(a.byCat).map(([c, kg]) => [c, round1(kg / a.people)]));
    const data = { homes: a.homes, people: a.people, kgPerPerson: round1(a.kg / a.people), byCategory: JSON.stringify(perPerson), computedAt: new Date() };
    await db.areaStat.upsert({ where: { level_key_month: { level, key, month } }, create: { level, key, month, ...data }, update: data });
  }
  return buckets.size;
}

/** The nightly job: regroup, then totals for every month with data in the last year. */
export async function runAreaJob(now = new Date()) {
  await formMohallas();
  const since = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString().slice(0, 7);
  const rows = await db.monthlySummary.findMany({ where: { month: { gte: since }, totalKg: { gt: 0 } }, distinct: ["month"], select: { month: true } });
  const months = rows.map((r) => r.month).sort();
  let n = 0;
  for (const m of months) n += await computeAreaStats(m);
  return { months, areas: n };
}

const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export type AreaLevel = {
  level: "HOME" | "MOHALLA" | "CITY" | "STATE" | "INDIA";
  name: string;
  nameHi: string;
  homes: number | null;
  kgPerPerson: number | null;
  prevKgPerPerson: number | null;
  hidden: boolean;
};

export type FeedItem = {
  kind: "HEAT" | "AIR" | "TREND" | "COMPARE" | "TIP" | "RAIN" | "GREEN" | "SHOPS" | "SCHEME";
  title: { en: string; hi: string };
  en: string;
  hi: string;
  source: string;
};

/** Facts about the whole mohalla, only ever as counts across its homes (and only when it has enough homes). */
export type MohallaFacts = { homesWithData: number; green: number; shopItems: number; efficientItems: number; schemeAsks: number; schemeApplied: number };

/** Everything the Mohalla page shows, from precomputed rows and the weather cache. */
export async function mohallaView(householdId: string) {
  const h = await db.household.findUnique({
    where: { id: householdId },
    select: {
      size: true,
      city: true,
      state: true,
      location: { include: { mohalla: true } },
      appliances: { where: { type: "AC" }, select: { powerKw: true } },
    },
  });
  if (!h) throw new LocationError("Household not found", 404);
  const min = minHomes();
  if (!h.location) return { location: null, minHomes: min };

  const st = stateCode(h.state);
  // the same month the home screen reports, so the numbers agree
  const month = (await resolveReportingPeriod(householdId, null)).month;
  const mine = await db.monthlySummary.findUnique({ where: { householdId_month: { householdId, month } } });
  const prev = month ? prevMonth(month) : null;
  const keys = [
    ["MOHALLA", h.location.mohallaId ?? "-"],
    ["CITY", `${h.city}|${st}`],
    ["STATE", st],
    ["INDIA", "IN"],
  ] as const;
  const stats = month
    ? await db.areaStat.findMany({ where: { OR: keys.map(([level, key]) => ({ level, key, month: { in: [month, prev!] } })) } })
    : [];
  const pick = (level: string, key: string, m: string | null) => stats.find((s) => s.level === level && s.key === key && s.month === m) ?? null;
  const si = stateInfo(h.state);
  const names: Record<string, [string, string]> = {
    MOHALLA: [h.location.mohalla?.name ?? "Your mohalla", "आपका मोहल्ला"],
    CITY: [h.city, h.city],
    STATE: [si.name, si.nameHi],
    INDIA: ["India", "भारत"],
  };
  const levels: AreaLevel[] = [
    {
      level: "HOME",
      name: "Your home",
      nameHi: "आपका घर",
      homes: 1,
      kgPerPerson: mine ? round1(mine.totalKg / Math.max(1, h.size)) : null,
      prevKgPerPerson: null,
      hidden: false,
    },
    ...keys.map(([level, key]) => {
      const cur = pick(level, key, month);
      const before = pick(level, key, prev);
      const hidden = !cur || cur.homes < min;
      return {
        level,
        name: names[level][0],
        nameHi: names[level][1],
        homes: cur?.homes ?? (level === "MOHALLA" ? h.location!.mohalla?.homes ?? 1 : 0),
        kgPerPerson: hidden ? null : cur!.kgPerPerson,
        prevKgPerPerson: hidden || !before || before.homes < min ? null : before.kgPerPerson,
        hidden,
      } as AreaLevel;
    }),
  ];

  const weather = await weatherFor(h.location.h3Area);
  const acKw = h.appliances.reduce((a, x) => a + x.powerKw, 0);
  const homesHere = h.location.mohalla?.homes ?? 1;
  const shareable = !!h.location.mohallaId && homesHere >= min;
  const facts = shareable ? await mohallaFacts(h.location.mohallaId!, month) : null;
  const place = h.location.mohalla?.name.split(" · ").slice(1).join(" · ") || h.location.locality || h.city;
  const feed = buildFeed({ weather, levels, acKw, month, facts, place });

  return {
    minHomes: min,
    month,
    location: {
      source: h.location.source,
      pincode: h.location.pincode,
      locality: h.location.locality,
      district: h.location.district,
      updatedAt: h.location.updatedAt.toISOString(),
    },
    mohalla: h.location.mohalla ? { name: h.location.mohalla.name, homes: h.location.mohalla.homes } : null,
    levels,
    weather,
    heat: weather?.days[1] ? heatForecast(weather.days[1].maxC, acKw) : null,
    feed,
    facts,
    demoHomes: h.location.mohallaId ? await db.householdLocation.count({ where: { mohallaId: h.location.mohallaId, household: { demo: true } } }) : 0,
    map: await mohallaMap(h.location.h3Cell, h.location.h3Area, shareable ? h.location.mohallaId : null),
    official: officialFor(h.city, st).map((o) => ({ ...o, monthlyKg: monthlyKg(o.perCapitaT) })),
    place,
  };
}

/** Counts across a mohalla's homes for one month: how many are green, what shops sold here, scheme help. */
export async function mohallaFacts(mohallaId: string, month: string): Promise<MohallaFacts> {
  const homes = await db.householdLocation.findMany({
    where: { mohallaId, household: { status: "ACTIVE" } },
    select: { householdId: true, household: { select: { size: true, state: true } } },
  });
  const ids = homes.map((x) => x.householdId);
  const yearAgo = new Date(Date.now() - 365 * 86_400_000);
  const [sums, sales, help] = await Promise.all([
    db.monthlySummary.findMany({ where: { householdId: { in: ids }, month, totalKg: { gt: 0 } }, select: { householdId: true, totalKg: true } }),
    db.merchantSale.findMany({
      where: { householdId: { in: ids }, createdAt: { gte: yearAgo }, status: { not: "REJECTED" } },
      select: { appliance: { select: { rating: true } }, vehicle: { select: { fuel: true } } },
    }),
    db.schemeHelp.findMany({ where: { householdId: { in: ids }, merchantId: { not: null } }, select: { householdId: true, status: true } }),
  ]);
  const byId = new Map(homes.map((x) => [x.householdId, x.household]));
  const { stateAverage } = await import("./allowance.service"); // allowance.service reads minHomes from here
  const averages = new Map<string, number>();
  for (const st of new Set(homes.map((x) => x.household.state))) averages.set(st, (await stateAverage(st, month)).perPersonKg);
  const green = sums.filter((s) => {
    const hh = byId.get(s.householdId)!;
    return statusFor(s.totalKg, averages.get(hh.state)! * Math.max(1, hh.size)) === "GREEN";
  }).length;
  const efficient = sales.filter((x) => (x.appliance && /5_STAR|INVERTER/.test(x.appliance.rating) && x.appliance.rating !== "NON_INVERTER") || x.vehicle?.fuel === "Electric").length;
  return {
    homesWithData: sums.length,
    green,
    shopItems: sales.length,
    efficientItems: efficient,
    schemeAsks: new Set(help.map((x) => x.householdId)).size,
    schemeApplied: new Set(help.filter((x) => x.status === "APPLIED").map((x) => x.householdId)).size,
  };
}

/**
 * Shapes for the map: the home's own small hexagon, and the mohalla's outline drawn from its homes' larger
 * (resolution 9, ~0.1 km²) cells, so no single house shows. Coordinates are [lat, lng].
 */
export async function mohallaMap(homeCell: string, area: string, mohallaId: string | null) {
  const ring = (cell: string) => cellToBoundary(cell) as [number, number][];
  let outline: [number, number][][] = [];
  if (mohallaId) {
    const cells = await db.householdLocation.findMany({ where: { mohallaId }, select: { h3Cell: true } });
    const parents = [...new Set(cells.map((c) => cellToParent(c.h3Cell, 9)))];
    outline = cellsToMultiPolygon(parents).map((poly) => poly[0] as [number, number][]);
  }
  const [lat, lng] = cellToLatLng(homeCell);
  const [wLat, wLng] = cellToLatLng(area);
  return { home: ring(homeCell), center: [lat, lng] as [number, number], outline, weatherPoint: [wLat, wLng] as [number, number] };
}

/** Rough, labelled estimate: on a hot day an AC runs about half an hour longer for each degree above 35 °C. */
export function heatForecast(maxC: number, acKw: number) {
  const extraHours = Math.min(6, Math.max(0, (maxC - 35) * 0.5));
  return { maxC: Math.round(maxC), level: heatLevel(maxC), extraKg: Math.round(acKw * extraHours * GRID_KG_PER_KWH * 10) / 10, extraHours };
}

/** "Mohalla Samachar": short news items written from today's facts, most important first. Every number says where it comes from. */
export function buildFeed({
  weather,
  levels,
  acKw,
  month,
  facts,
  place,
}: {
  weather: Weather | null;
  levels: AreaLevel[];
  acKw: number;
  month: string | null;
  facts?: MohallaFacts | null;
  place?: string;
}): FeedItem[] {
  const feed: FeedItem[] = [];
  const where = place ?? "your mohalla";
  const tomorrow = weather?.days[1];
  if (tomorrow) {
    const hf = heatForecast(tomorrow.maxC, acKw);
    if (hf.level !== "NONE") {
      feed.push({
        kind: "HEAT",
        title: { en: `Heat alert: ${hf.maxC}°C tomorrow`, hi: `लू की चेतावनी: कल ${hf.maxC}°C` },
        en: `${hf.level === "SEVERE" ? "Severe heat" : "A heatwave day"} is forecast. ${acKw ? `Your ACs may run about ${hf.extraHours} hours longer: roughly +${hf.extraKg} kg CO₂e.` : ""} Drink water often, avoid the sun from noon to 3 pm, and check on elderly neighbours.`,
        hi: `${hf.level === "SEVERE" ? "भीषण गर्मी" : "लू"} का अनुमान है। ${acKw ? `आपके एसी लगभग ${hf.extraHours} घंटे ज़्यादा चल सकते हैं: लगभग +${hf.extraKg} किलो CO₂e।` : ""} बार-बार पानी पिएँ, दोपहर 12 से 3 बजे धूप से बचें, बुज़ुर्ग पड़ोसियों का हाल पूछें।`,
        source: "Open-Meteo forecast; heat advice: NDMA heatwave guidelines; AC estimate from your registered ACs",
      });
    } else if (tomorrow.rainPct !== null && tomorrow.rainPct >= 60) {
      feed.push({
        kind: "RAIN",
        title: { en: `Rain likely tomorrow (${tomorrow.rainPct}%)`, hi: `कल बारिश की संभावना (${tomorrow.rainPct}%)` },
        en: "A cooler day: a good day to give the AC a rest and open the windows in the evening.",
        hi: "ठंडा दिन: एसी को आराम दें और शाम को खिड़कियाँ खोलें।",
        source: "Open-Meteo forecast",
      });
    }
  }
  const moh = levels.find((l) => l.level === "MOHALLA");
  if (moh && !moh.hidden && moh.kgPerPerson !== null && moh.prevKgPerPerson) {
    const pct = Math.round(((moh.kgPerPerson - moh.prevKgPerPerson) / moh.prevKgPerPerson) * 100);
    if (pct !== 0) {
      feed.push({
        kind: "TREND",
        title: {
          en: `${where} ${pct < 0 ? "cuts" : "raises"} its carbon by ${Math.abs(pct)}%`,
          hi: `${where} का कार्बन ${Math.abs(pct)}% ${pct < 0 ? "घटा" : "बढ़ा"}`,
        },
        en: `Each person here averaged ${moh.kgPerPerson} kg of CO₂ this month, against ${moh.prevKgPerPerson} kg the month before.${pct > 0 ? " Most of the rise usually comes from longer AC hours." : ""}`,
        hi: `यहाँ प्रति व्यक्ति इस महीने ${moh.kgPerPerson} किलो CO₂e रहा, पिछले महीने ${moh.prevKgPerPerson} किलो।${pct > 0 ? " बढ़ोतरी ज़्यादातर एसी के ज़्यादा चलने से आती है।" : ""}`,
        source: `${moh.homes} Carbon Wallet homes in the mohalla${month ? `, ${month}` : ""}`,
      });
    }
  }
  if (facts && facts.homesWithData > 0) {
    const pct = Math.round((facts.green / facts.homesWithData) * 100);
    feed.push({
      kind: "GREEN",
      title: { en: `${facts.green} of ${facts.homesWithData} homes are green`, hi: `${facts.homesWithData} में से ${facts.green} घर हरे` },
      en: `${pct}% of homes here stayed below their state's average for a home of their size this month.`,
      hi: `इस महीने यहाँ के ${pct}% घर अपने आकार के घर के राज्य औसत से नीचे रहे।`,
      source: "Carbon Wallet, counted across the mohalla (never one home)",
    });
  }
  if (facts && facts.shopItems > 0) {
    const pct = Math.round((facts.efficientItems / facts.shopItems) * 100);
    feed.push({
      kind: "SHOPS",
      title: { en: `${facts.shopItems} new items bought this year, ${pct}% efficient`, hi: `इस साल ${facts.shopItems} नया सामान, ${pct}% कुशल` },
      en: `Shops registered ${facts.shopItems} appliances and vehicles to homes here in the last 12 months; ${facts.efficientItems} were 5-star, inverter or electric.`,
      hi: `पिछले 12 महीनों में दुकानों ने यहाँ के घरों में ${facts.shopItems} उपकरण और वाहन जोड़े; ${facts.efficientItems} 5-स्टार, इन्वर्टर या इलेक्ट्रिक थे।`,
      source: "Registrations at Carbon Wallet shop counters",
    });
  }
  if (facts && facts.schemeAsks > 0) {
    feed.push({
      kind: "SCHEME",
      title: { en: `${facts.schemeAsks} homes heard about a government scheme at a shop`, hi: `${facts.schemeAsks} घरों को दुकान पर सरकारी योजना की जानकारी मिली` },
      en: `${facts.schemeApplied} of them applied with the shop's help. See which schemes fit your home on the Govt schemes page.`,
      hi: `इनमें से ${facts.schemeApplied} ने दुकान की मदद से आवेदन किया। आपके घर के लिए योजनाएँ "सरकारी योजना" पेज पर देखें।`,
      source: "Help recorded at Carbon Wallet shop counters",
    });
  }
  if (weather?.air?.aqi != null && weather.air.band) {
    const bad = weather.air.aqi > 200;
    feed.push({
      kind: "AIR",
      title: { en: `Air quality ${weather.air.band.toLowerCase()}: AQI ${weather.air.aqi}`, hi: `हवा ${AQI_HI[weather.air.band]}: AQI ${weather.air.aqi}` },
      en: bad
        ? "Avoid burning waste or leaves; keep windows shut in the afternoon; children and the elderly should limit time outdoors."
        : "Air is fine for being outdoors today.",
      hi: bad ? "कूड़ा या पत्ते न जलाएँ; दोपहर में खिड़कियाँ बंद रखें; बच्चे और बुज़ुर्ग बाहर कम रहें।" : "आज बाहर रहने के लिए हवा ठीक है।",
      source: "Open-Meteo air quality (CAMS), Indian AQI from PM2.5 / PM10 with CPCB breakpoints",
    });
  }
  const home = levels.find((l) => l.level === "HOME");
  const city = levels.find((l) => l.level === "CITY");
  if (home?.kgPerPerson && city && !city.hidden && city.kgPerPerson) {
    const diff = Math.round(((home.kgPerPerson - city.kgPerPerson) / city.kgPerPerson) * 100);
    feed.push({
      kind: "COMPARE",
      title: { en: `Your home vs ${city.name}: ${Math.abs(diff)}% ${diff <= 0 ? "lower" : "higher"}`, hi: `आपका घर बनाम ${city.nameHi}: ${Math.abs(diff)}% ${diff <= 0 ? "कम" : "ज़्यादा"}` },
      en: `Each person in your home: ${home.kgPerPerson} kg. ${city.name} average: ${city.kgPerPerson} kg.`,
      hi: `आपके घर में प्रति व्यक्ति: ${home.kgPerPerson} किलो। ${city.nameHi} औसत: ${city.kgPerPerson} किलो।`,
      source: `${city.homes} Carbon Wallet homes in ${city.name}`,
    });
  }
  if (acKw > 0) {
    feed.push({
      kind: "TIP",
      title: { en: "Tip: 24–26°C is the right AC setting", hi: "सुझाव: एसी 24–26°C पर रखें" },
      en: "Each degree warmer saves about 6% of the AC's electricity, and 24°C is the default BEE asks makers to set.",
      hi: "हर एक डिग्री बढ़ाने से एसी की लगभग 6% बिजली बचती है; BEE ने 24°C को डिफ़ॉल्ट रखने को कहा है।",
      source: "Bureau of Energy Efficiency guidance",
    });
  }
  return feed;
}

const AQI_HI: Record<string, string> = {
  Good: "अच्छी",
  Satisfactory: "संतोषजनक",
  Moderate: "मध्यम",
  Poor: "ख़राब",
  "Very poor": "बहुत ख़राब",
  Severe: "गंभीर",
};

/** India Post office lookup, then a rough point for the map from OpenStreetMap (Nominatim). Server-side, cached. */
const pinCache = new Map<string, { at: number; value: unknown }>();
export async function lookupPincode(pin: string) {
  if (!/^[1-9][0-9]{5}$/.test(pin)) throw new LocationError("A pincode has 6 digits.", 400);
  const hit = pinCache.get(pin);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.value;
  const ua = { "user-agent": `CarbonWallet/0.2 (hackathon; ${process.env.CONTACT_EMAIL ?? "contact via site"})` };
  const [post, geo] = await Promise.all([
    fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(5000), headers: ua })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=India&format=json&limit=1`, { signal: AbortSignal.timeout(5000), headers: ua })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  const offices = (post?.[0]?.PostOffice ?? []) as { Name: string; District: string; State: string; Block?: string }[];
  const value = {
    pincode: pin,
    places: offices.slice(0, 25).map((o) => ({ name: o.Name, district: o.District, state: o.State })),
    center: geo?.[0] ? { lat: Number(geo[0].lat), lng: Number(geo[0].lon) } : null,
  };
  if (!offices.length && !value.center) throw new LocationError("We couldn't find that pincode. Check the 6 digits.", 404);
  pinCache.set(pin, { at: Date.now(), value });
  return value;
}
