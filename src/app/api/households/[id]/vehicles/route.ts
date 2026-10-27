import { NextRequest, NextResponse } from "next/server";
import { ITEMS_BY_SHOPS } from "@/lib/assets";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";


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

/** Households don't add items: the shop that sells one registers it at the counter (merchant.service.ts). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "asset:create");
    return NextResponse.json({ error: ITEMS_BY_SHOPS, code: "ITEMS_BY_SHOPS" }, { status: 403 });
  } catch (err) {
    return handleAuthError(err);
  }
}
