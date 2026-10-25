import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { FuelError, fuelService } from "@/server/services/fuel.service";
import { verifyCommitments } from "@/server/services/commitment.service";

const ConfirmSchema = z.object({
  vehicleId: z.string().min(1),
  quantity: z.number().positive().max(200),
  amountInr: z.number().nonnegative().max(100000).nullish(),
  pricePerUnit: z.number().positive().max(500).nullish(),
  filledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["PHOTO", "MANUAL"]).default("MANUAL"),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    return NextResponse.json({ fillUps: await fuelService.list(householdId) });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "activity:create");
    const parsed = ConfirmSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid fill-up" }, { status: 400 });
    try {
      const out = await fuelService.confirm({ householdId, userId: auth.userId, ...parsed.data });
      await verifyCommitments(householdId).catch(() => {}); // fill-ups may settle a commitment
      return NextResponse.json({ id: out.log.id, kgCo2e: out.log.kgCo2e, coveredTrips: out.coveredTrips }, { status: 201 });
    } catch (err) {
      if (err instanceof FuelError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
