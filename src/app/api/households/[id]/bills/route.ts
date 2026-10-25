import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership } from "@/server/auth/guard";
import { billService } from "@/server/services/bill.service";
import { billErrorResponse } from "@/server/services/bill.http";
import { verifyCommitments } from "@/server/services/commitment.service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const ConfirmSchema = z.object({
  documentId: z.string().min(1).max(40).nullish(),
  periodStart: isoDate,
  periodEnd: isoDate,
  kwh: z.number().positive().max(20000),
  amountInr: z.number().nonnegative().max(1_000_000).nullish(),
  importKwh: z.number().nonnegative().max(20000).nullish(),
  exportKwh: z.number().nonnegative().max(20000).nullish(),
  acHoursPerDay: z.number().min(0).max(24).optional(),
  deleteOriginal: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    return NextResponse.json(await billService.list(householdId));
  } catch (err) {
    return billErrorResponse(err);
  }
}

/** Confirms a reviewed bill (from an upload, or typed in by hand) and books its kWh. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "bill:create");
    const parsed = ConfirmSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid bill" }, { status: 400 });
    }
    const bill = await billService.confirm({ householdId, userId: auth.userId, ...parsed.data });
    await verifyCommitments(householdId).catch(() => {}); // a new bill may settle a commitment
    return NextResponse.json({ bill: { id: bill.id } }, { status: 201 });
  } catch (err) {
    return billErrorResponse(err);
  }
}
