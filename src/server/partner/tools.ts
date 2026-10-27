import * as z from "zod/v4";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Merchant } from "@prisma/client";
import { db } from "@/server/db";
import { homeStatus } from "@/server/services/allowance.service";
import { schemesForHousehold } from "@/server/services/scheme.service";
import { mohallaView } from "@/server/services/mohalla.service";
import { listForHousehold } from "@/server/services/removal.service";
import { myGrievances } from "@/server/services/grievance.service";
import { listCatalogue, merchantDashboard } from "@/server/services/catalogue.service";
import { listSales } from "@/server/services/merchant.service";
import { portalStats } from "@/server/services/portal.service";
import { forecastFor } from "@/server/services/mlForecast.service";
import { describeTables, readOnlyQuery, SqlRejected } from "./readOnlySql";
import type { PartnerRole } from "./knowledge";

/*
 * What Partner can look up, per kind of account. Every tool only reads, and only what that person could already
 * see on the website: a household member sees their own home, a shop its own shop, an admin everything (read only).
 */

export type PartnerContext = {
  role: PartnerRole;
  userId: string | null;
  householdId: string | null;
  merchant: Merchant | null;
};

const out = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x)).slice(0, 12_000);

// streamed requests: let each tool's input stream as it is written (betaZodTool still validates it before run)
function tool<S extends z.ZodType>(def: Parameters<typeof betaZodTool<S>>[0]) {
  return { ...betaZodTool(def), eager_input_streaming: true };
}

const Empty = z.object({});

function householdTools(householdId: string, userId: string) {
  return [
    tool({
      name: "my_home",
      description: "The user's home: name, city, people, Carbon ID, the last three months' CO₂ by category, and this month's green/amber/red status against the state allowance.",
      inputSchema: Empty,
      run: async () => {
        const h = await db.household.findUnique({
          where: { id: householdId },
          select: { name: true, city: true, state: true, size: true, homeType: true, carbonId: true, memberships: { where: { status: "ACTIVE" }, select: { role: true, userId: true } } },
        });
        if (!h) return "Home not found.";
        const months = await db.monthlySummary.findMany({ where: { householdId }, orderBy: { month: "desc" }, take: 3, select: { month: true, totalKg: true, byCategory: true, score: true } });
        const latest = months[0];
        const status = latest ? await homeStatus(h.size, latest.totalKg) : null;
        return out({
          name: h.name,
          city: h.city,
          state: h.state,
          people: h.size,
          homeType: h.homeType,
          carbonId: h.carbonId,
          members: h.memberships.length,
          yourRole: h.memberships.find((m) => m.userId === userId)?.role,
          months: months.map((m) => ({ month: m.month, kgCO2: Math.round(m.totalKg), score: Math.round(m.score), byCategory: JSON.parse(m.byCategory || "{}") })),
          status: status && { allowanceKg: status.allowanceKg, usedShare: status.ratio, status: status.status, allowanceBasis: "100 kg CO₂e per person a month × the people in the home" },
        });
      },
    }),
    tool({
      name: "my_items",
      description: "Appliances and vehicles registered to the user's home, with power, hours of use, star rating and who registered them.",
      inputSchema: Empty,
      run: async () => {
        const [appliances, vehicles] = await Promise.all([
          db.appliance.findMany({ where: { householdId }, select: { name: true, type: true, rating: true, powerKw: true, avgHoursPerDay: true, source: true, brand: true, model: true } }),
          db.vehicle.findMany({ where: { householdId }, select: { name: true, type: true, fuel: true, kmPerUnit: true, monthlyKm: true, year: true, source: true } }),
        ]);
        return out({ appliances, vehicles });
      },
    }),
    tool({
      name: "my_bills",
      description: "The home's last 12 electricity bills: period, units (kWh), amount in rupees.",
      inputSchema: Empty,
      run: async () => {
        const bills = await db.bill.findMany({ where: { householdId }, orderBy: { periodEnd: "desc" }, take: 12, select: { periodStart: true, periodEnd: true, kwh: true, amountInr: true } });
        return out(bills.map((b) => ({ from: b.periodStart.toISOString().slice(0, 10), to: b.periodEnd.toISOString().slice(0, 10), kwh: b.kwh, amountInr: b.amountInr, approxKgCO2: Math.round(b.kwh * 0.675) })));
      },
    }),
    tool({
      name: "my_schemes",
      description: "Government schemes this home may qualify for, worked out from its bills and items, with why and how to apply.",
      inputSchema: Empty,
      run: async () => out(await schemesForHousehold(householdId)),
    }),
    tool({
      name: "my_mohalla",
      description: "The home's mohalla (locality group): weather, heat and air quality, area numbers, local news items. Empty if the location isn't set.",
      inputSchema: Empty,
      run: async () => {
        // the map's cells are many and say nothing in words; leave them out
        const view = { ...((await mohallaView(householdId)) as Record<string, unknown>) };
        delete view.map;
        delete view.demoHomes;
        return out(view);
      },
    }),
    tool({
      name: "my_forecast",
      description: "The machine-learned forecast of the home's CO₂ for next month: expected kg, likely range, and the reasons in kg (weather, ACs, recent trend…).",
      inputSchema: Empty,
      run: async () => out((await forecastFor(householdId).catch((e: Error) => ({ unavailable: e.message }))) ?? { unavailable: "Not enough history yet: needs at least last month's total." }),
    }),
    tool({
      name: "my_requests",
      description: "The home's removal requests (with status and admin replies) and the user's complaint tickets.",
      inputSchema: Empty,
      run: async () => out({ removals: await listForHousehold(householdId), complaints: await myGrievances(userId) }),
    }),
  ];
}

function merchantTools(merchant: Merchant) {
  return [
    tool({
      name: "shop_dashboard",
      description: "The shop's numbers: items registered this month and in total, customers, share of efficient items, rejections, scheme help, revenue, top products.",
      inputSchema: Empty,
      run: async () => out(await merchantDashboard(merchant)),
    }),
    tool({
      name: "shop_catalogue",
      description: "The shop's catalogue products: SKU, title, price, stars, whether shown at the counter, units sold.",
      inputSchema: Empty,
      run: async () =>
        out((await listCatalogue(merchant.id)).map((i) => ({ sku: i.sku, title: i.title, priceInr: i.priceInr, stars: i.stars, kind: i.kind, type: i.type, active: i.active, sold: i.sold, hasPhoto: !!i.imageUrl }))),
    }),
    tool({
      name: "shop_sales",
      description: "The shop's latest 50 registrations: date, item, customer's Carbon ID, status (registered, rejected by owner, removed).",
      inputSchema: Empty,
      run: async () => out(await listSales(merchant.id, 50)),
    }),
  ];
}

function adminTools() {
  return [
    tool({
      name: "platform_overview",
      description: "Platform-wide counts: users, homes, shops, and what is waiting for an admin (shops to approve, removal requests, open complaints).",
      inputSchema: Empty,
      run: async () => {
        const [stats, shopsPending, removalsPending, complaintsOpen] = await Promise.all([
          portalStats(),
          db.merchant.count({ where: { status: "PENDING" } }),
          db.removalRequest.count({ where: { status: "PENDING" } }),
          db.grievance.count({ where: { status: { not: "RESOLVED" } } }),
        ]);
        return out({ ...stats, waiting: { shopsPending, removalsPending, complaintsOpen } });
      },
    }),
    tool({
      name: "find_households",
      description: "Search homes by name, Carbon ID or city (up to 20), with their latest month's CO₂.",
      inputSchema: z.object({ query: z.string().min(2).max(80).describe("Part of the home's name, Carbon ID or city") }),
      run: async ({ query }) => {
        const homes = await db.household.findMany({
          where: { OR: [{ name: { contains: query } }, { carbonId: { contains: query } }, { city: { contains: query } }] },
          take: 20,
          select: { id: true, name: true, city: true, state: true, size: true, carbonId: true, status: true, monthlySummaries: { orderBy: { month: "desc" }, take: 1, select: { month: true, totalKg: true } } },
        });
        return out(homes);
      },
    }),
    tool({
      name: "list_tables",
      description: "Every database table and its columns. Call this before writing a SQL query.",
      inputSchema: Empty,
      run: async () => out(await describeTables()),
    }),
    tool({
      name: "run_sql",
      description:
        "Run ONE read-only SQL query (SELECT or WITH … SELECT) on the Carbon Wallet database and get up to 200 rows. Writing is impossible: INSERT/UPDATE/DELETE and similar are refused, and secret columns (passwords, tokens, card codes) come back as [hidden]. Table and column names are snake_case as listed by list_tables.",
      inputSchema: z.object({ sql: z.string().min(6).max(4000), why: z.string().max(200).describe("One line: what this query answers") }),
      run: async ({ sql }) => {
        try {
          return out(await readOnlyQuery(sql));
        } catch (err) {
          if (err instanceof SqlRejected) return `Refused: ${err.message}`;
          return `The query failed: ${(err as Error).message.split("\n").slice(-1)[0]?.slice(0, 300)}`;
        }
      },
    }),
  ];
}

export function partnerTools(ctx: PartnerContext) {
  if (ctx.role === "admin") return adminTools();
  if (ctx.role === "merchant" && ctx.merchant) return merchantTools(ctx.merchant);
  if (ctx.role === "household" && ctx.householdId && ctx.userId) return householdTools(ctx.householdId, ctx.userId);
  return [];
}
