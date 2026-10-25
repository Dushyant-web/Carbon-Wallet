import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { currentMonthIST, resolveReportingPeriod } from "@/server/period";
import { z } from "zod";
import { getRequestUser } from "@/server/auth/session";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";

const CreateHouseholdSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  size: z.number().int().positive().default(4),
  homeType: z.string().default("Apartment"),
  floorAreaM2: z.number().positive().default(160),
  monthlyBudgetInr: z.number().optional(),
  primaryVehicle: z.string().optional(),
  hasSolar: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search")?.toLowerCase() || "";
    const state = searchParams.get("state") || undefined;
    const sizeBand = searchParams.get("sizeBand") || undefined;
    const sort = searchParams.get("sort") || "name_asc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "100", 10));

    const where: Record<string, unknown> = { status: "ACTIVE" };
    // Tenancy: users only see households they belong to; platform admins see all.
    const user = await getRequestUser(req);
    if (!user && process.env.DEMO_AUTH !== "1") {
      return NextResponse.json({ error: "Unauthenticated: please log in" }, { status: 401 });
    }
    if (user && user.platformRole !== "ADMIN") {
      where.memberships = { some: { userId: user.id, status: "ACTIVE" } };
    }
    if (state && state !== "all") {
      const s = state.toUpperCase().trim();
      let stateCodes = [state];
      if (s === "UP" || s === "UTTAR PRADESH") stateCodes = ["UP", "Uttar Pradesh"];
      else if (s === "DL" || s === "DELHI" || s === "NEW DELHI") stateCodes = ["DL", "Delhi"];
      else if (s === "HR" || s === "HARYANA") stateCodes = ["HR", "Haryana"];
      else if (s === "MH" || s === "MAHARASHTRA") stateCodes = ["MH", "Maharashtra"];
      else if (s === "KA" || s === "KARNATAKA") stateCodes = ["KA", "Karnataka"];
      else if (s === "TN" || s === "TAMIL NADU") stateCodes = ["TN", "Tamil Nadu"];
      else if (s === "RJ" || s === "RAJASTHAN") stateCodes = ["RJ", "Rajasthan"];
      else if (s === "WB" || s === "WEST BENGAL") stateCodes = ["WB", "West Bengal"];

      where.state = { in: stateCodes };
    }
    if (sizeBand && sizeBand !== "all") {
      if (sizeBand === "small") where.size = { lte: 3 };
      else if (sizeBand === "medium") where.size = { in: [4, 5] };
      else if (sizeBand === "large") where.size = { gte: 6 };
    }

    const households = await db.household.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
        monthlySummaries: {
          where: { month: { lt: currentMonthIST() }, totalKg: { gt: 0 } },
          orderBy: { month: "desc" },
          take: 24,
        },
      },
    });

    // Same reporting month as the overview: latest month with data that bills cover fully
    const reporting = new Map(
      await Promise.all(households.map(async (h) => [h.id, (await resolveReportingPeriod(h.id)).month] as const)),
    );
    let formatted = households.map((h) => {
      const currentMonthSummary = h.monthlySummaries.find((m) => m.month === reporting.get(h.id));
      return {
        id: h.id,
        name: h.name,
        city: h.city,
        state: h.state,
        country: h.country,
        size: h.size,
        homeType: h.homeType,
        floorAreaM2: h.floorAreaM2,
        joinCode: h.joinCode,
        status: h.status,
        currentEmissions: currentMonthSummary?.totalKg ?? 0,
        score: currentMonthSummary ? Math.round(currentMonthSummary.score) : null,
        reportingMonth: currentMonthSummary?.month ?? null,
        memberCount: h.memberships.length,
      };
    });

    if (search) {
      formatted = formatted.filter(
        (h) =>
          h.name.toLowerCase().includes(search) ||
          h.city.toLowerCase().includes(search) ||
          h.state.toLowerCase().includes(search)
      );
    }

    // Sort
    if (sort === "name_asc") {
      formatted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "name_desc") {
      formatted.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === "emissions_asc") {
      formatted.sort((a, b) => a.currentEmissions - b.currentEmissions);
    } else if (sort === "emissions_desc") {
      formatted.sort((a, b) => b.currentEmissions - a.currentEmissions);
    } else if (sort === "score_desc") {
      formatted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else if (sort === "score_asc") {
      formatted.sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
    }

    const total = formatted.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = formatted.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      households: paginated,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("Failed to list households:", err);
    return NextResponse.json({ error: "Failed to list households" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user && process.env.DEMO_AUTH !== "1") {
      return NextResponse.json({ error: "Unauthenticated: please log in" }, { status: 401 });
    }
    if (user?.platformRole === "MERCHANT") {
      return NextResponse.json({ error: "Shop accounts can't own a household. Sign up separately for your home." }, { status: 403 });
    }
    const body = await req.json();
    const data = CreateHouseholdSchema.parse(body);

    const joinCode = `HH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newHh = await db.household.create({
      data: {
        name: data.name,
        city: data.city,
        state: data.state,
        country: "IN",
        size: data.size,
        homeType: data.homeType,
        floorAreaM2: data.floorAreaM2,
        monthlyBudgetInr: data.monthlyBudgetInr,
        joinCode,
        status: "ACTIVE",
      },
    });

    await ensureHouseholdIdentity(newHh.id); // permanent Carbon ID, public share token and private card code

    // Creator becomes OWNER. The household starts empty: numbers only come from logged data.
    if (user) {
      await db.membership.create({
        data: { householdId: newHh.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
      });
    }
    await db.monthlySummary.create({
      data: {
        householdId: newHh.id,
        month: new Date().toISOString().slice(0, 7),
        totalKg: 0,
        byCategory: JSON.stringify({}),
        score: 0,
      },
    });

    return NextResponse.json({ household: newHh }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation Error", details: err }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create household" }, { status: 500 });
  }
}
