import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { billService } from "@/server/services/bill.service";
import { billErrorResponse } from "@/server/services/bill.http";

/** Removes a bill and the kWh it booked; logged electricity it covered counts again. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; billId: string }> }) {
  try {
    const { id: householdId, billId } = await params;
    const auth = await requireMembership(req, householdId, "activity:delete");
    await billService.remove(householdId, billId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return billErrorResponse(err);
  }
}
