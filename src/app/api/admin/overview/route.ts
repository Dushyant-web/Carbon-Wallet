import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAdmin, handleAuthError } from "@/server/auth/guard";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    // ?users=N sends only the N newest accounts (the Android admin app); the stats still count everyone
    const usersParam = req.nextUrl.searchParams.get("users");
    const usersLimit = usersParam !== null && /^\d{1,5}$/.test(usersParam) ? Number(usersParam) : undefined;
    const [users, households, activities, recentAudit] = await Promise.all([
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          platformRole: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          passwordHash: true,
          _count: { select: { memberships: true } },
        },
      }),
      db.household.count({ where: { status: "ACTIVE" } }),
      db.activity.count(),
      db.auditLog.findMany({
        orderBy: { at: "desc" },
        take: 12,
        include: { user: { select: { name: true } }, household: { select: { name: true } } },
      }),
    ]);

    // privacy: who asked to be erased and when it happens (read-only; nobody can stop or speed it up here)
    const [pendingUsers, pendingHouseholds, erasures] = await Promise.all([
      db.user.findMany({ where: { status: "DELETION_PENDING" }, select: { name: true, deletionRequestedAt: true }, orderBy: { deletionRequestedAt: "asc" } }),
      db.household.findMany({ where: { status: "DELETION_PENDING" }, select: { name: true, deletionRequestedAt: true }, orderBy: { deletionRequestedAt: "asc" } }),
      db.erasureLog.findMany({ orderBy: { at: "desc" }, take: 10 }),
    ]);
    const eraseOn = (d: Date | null) => (d ? new Date(d.getTime() + 30 * 86_400_000).toISOString() : null);

    return NextResponse.json({
      deletions: {
        pending: [
          ...pendingUsers.map((u) => ({ kind: "account", name: u.name, requestedAt: u.deletionRequestedAt, eraseOn: eraseOn(u.deletionRequestedAt) })),
          ...pendingHouseholds.map((h) => ({ kind: "household", name: h.name, requestedAt: h.deletionRequestedAt, eraseOn: eraseOn(h.deletionRequestedAt) })),
        ],
        erased: erasures,
      },
      stats: {
        users: users.length,
        usersWithLogin: users.filter((u) => u.passwordHash).length,
        admins: users.filter((u) => u.platformRole === "ADMIN").length,
        merchants: users.filter((u) => u.platformRole === "MERCHANT").length,
        merchantsPending: await db.merchant.count({ where: { status: "PENDING" } }),
        households,
        activities,
      },
      users: users.slice(0, usersLimit).map(({ passwordHash, _count, ...u }) => ({
        ...u,
        canLogIn: Boolean(passwordHash),
        households: _count.memberships,
      })),
      audit: recentAudit.map((a) => ({
        id: a.id,
        at: a.at,
        action: a.action,
        details: a.details,
        user: a.user?.name ?? "system",
        household: a.household.name,
      })),
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
