import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getRequestUser } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const memberships = await db.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    select: { householdId: true, role: true, household: { select: { name: true } } },
  });
  return NextResponse.json({
    user,
    households: memberships.map((m) => ({ id: m.householdId, name: m.household.name, role: m.role })),
  });
}
