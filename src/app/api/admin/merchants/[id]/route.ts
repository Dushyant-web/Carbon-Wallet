import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin, handleAuthError } from "@/server/auth/guard";

const PatchSchema = z.object({ status: z.enum(["APPROVED", "SUSPENDED"]) });

/** Approve a shop so it can scan cards, or suspend it (its scans stop working at once). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "status must be APPROVED or SUSPENDED" }, { status: 400 });
    const found = await db.merchant.findUnique({ where: { id } });
    if (!found) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    const merchant = await db.merchant.update({ where: { id }, data: { status: parsed.data.status, reviewedAt: new Date() } });
    if (parsed.data.status === "SUSPENDED") {
      await db.merchantScan.updateMany({ where: { merchantId: id, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } });
    }
    return NextResponse.json({ merchant: { id: merchant.id, status: merchant.status } });
  } catch (err) {
    return handleAuthError(err);
  }
}
