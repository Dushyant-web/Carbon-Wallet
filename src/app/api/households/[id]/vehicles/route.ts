import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { z } from "zod";

const VehicleSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("Car"),
  fuel: z.string().default("Petrol"),
  kmPerUnit: z.number().positive().default(14.0),
  monthlyKm: z.number().positive().default(300.0),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const vehicles = await db.vehicle.findMany({
      where: { householdId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ vehicles });
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
    const data = VehicleSchema.parse(body);

    const vehicle = await db.vehicle.create({
      data: {
        householdId,
        ...data,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation Error", details: err }, { status: 400 });
    }
    return handleAuthError(err);
  }
}
