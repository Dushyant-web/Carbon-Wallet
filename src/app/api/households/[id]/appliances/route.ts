import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { z } from "zod";

const ApplianceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  rating: z.string().default("3_STAR"),
  powerKw: z.number().positive(),
  avgHoursPerDay: z.number().positive().default(4.0),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const appliances = await db.appliance.findMany({
      where: { householdId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ appliances });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "asset:create");

    const body = await req.json();
    const data = ApplianceSchema.parse(body);

    const appliance = await db.appliance.create({
      data: {
        householdId,
        ...data,
      },
    });

    return NextResponse.json({ appliance }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation Error", details: err }, { status: 400 });
    }
    return handleAuthError(err);
  }
}
