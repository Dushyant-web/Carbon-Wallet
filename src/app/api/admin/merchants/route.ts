import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAdmin, handleAuthError } from "@/server/auth/guard";

/** Every shop, waiting ones first, with how many items it registered and how many owners turned down. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [merchants, counts] = await Promise.all([
      db.merchant.findMany({ include: { user: { select: { name: true, email: true, status: true } } }, orderBy: { createdAt: "desc" } }),
      db.merchantSale.groupBy({ by: ["merchantId", "status"], _count: { _all: true } }),
    ]);
    const count = (merchantId: string, status?: string) =>
      counts.filter((c) => c.merchantId === merchantId && (!status || c.status === status)).reduce((n, c) => n + c._count._all, 0);
    const order: Record<string, number> = { PENDING: 0, APPROVED: 1, SUSPENDED: 2 };
    return NextResponse.json({
      merchants: merchants
        .map((m) => ({
          id: m.id,
          businessName: m.businessName,
          gstin: m.gstin,
          city: m.city,
          state: m.state,
          sells: m.sells,
          status: m.status,
          contact: { name: m.user.name, email: m.user.email, accountStatus: m.user.status },
          createdAt: m.createdAt.toISOString(),
          reviewedAt: m.reviewedAt?.toISOString() ?? null,
          registered: count(m.id),
          rejected: count(m.id, "REJECTED"),
        }))
        .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)),
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
