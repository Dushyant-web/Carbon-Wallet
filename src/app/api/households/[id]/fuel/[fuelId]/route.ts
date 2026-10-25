import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { FuelError, fuelService } from "@/server/services/fuel.service";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fuelId: string }> }) {
  try {
    const { id: householdId, fuelId } = await params;
    const auth = await requireMembership(req, householdId, "activity:delete");
    try {
      await fuelService.remove(householdId, fuelId, auth.userId);
      return NextResponse.json({ ok: true });
    } catch (err) {
      if (err instanceof FuelError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
