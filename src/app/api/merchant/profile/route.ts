import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { MerchantProfileSchema } from "@/lib/merchant";

/** A shop that signed in with Google tells us about the shop; it then waits for an admin like any other. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user.platformRole !== "MERCHANT") return NextResponse.json({ error: "Shops only" }, { status: 403 });
    if (await db.merchant.findUnique({ where: { userId: user.id } })) return NextResponse.json({ error: "Your shop is already registered." }, { status: 409 });
    const shop = MerchantProfileSchema.safeParse(await req.json().catch(() => null));
    if (!shop.success) return NextResponse.json({ error: shop.error.issues[0]?.message ?? "Enter the shop's details." }, { status: 400 });
    await db.merchant.create({ data: { userId: user.id, ...shop.data, gstin: shop.data.gstin ?? null } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleAuthError(err);
  }
}
