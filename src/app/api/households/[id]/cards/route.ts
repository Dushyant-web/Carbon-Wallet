import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { normalizeUid } from "@/server/services/card.service";

const PairSchema = z.object({ uid: z.string().min(8).max(40), label: z.string().trim().min(1).max(40).optional() });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    const cards = await db.card.findMany({ where: { householdId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({
      cards: cards.map((c) => ({
        id: c.id,
        label: c.label,
        uidMasked: `••••${c.uid.slice(-4)}`,
        status: c.status,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt,
      })),
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Pairs a physical NFC card (by chip UID) with this household. Owner/Admin only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "household:update");
    const parsed = PairSchema.safeParse(await req.json().catch(() => null));
    const uid = parsed.success ? normalizeUid(parsed.data.uid) : null;
    if (!parsed.success || !uid) {
      return NextResponse.json({ error: "Enter the chip UID as 8, 14 or 20 hex characters (e.g. 04:A2:3F:1B:2C:80:90)." }, { status: 400 });
    }
    try {
      const card = await db.card.create({ data: { householdId, uid, label: parsed.data.label ?? "Carbon Card" } });
      await db.auditLog.create({
        data: { householdId, userId: auth.userId, action: "card.pair", entity: "Card", details: `Paired card ••••${uid.slice(-4)}` },
      });
      return NextResponse.json({ card: { id: card.id, label: card.label, uidMasked: `••••${uid.slice(-4)}`, status: card.status } }, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json({ error: "This card is already paired to a household." }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
