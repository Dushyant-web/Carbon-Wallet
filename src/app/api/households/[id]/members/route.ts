import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { z } from "zod";

const AddMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const memberships = await db.membership.findMany({
      where: { householdId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });

    const members = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));

    return NextResponse.json({ members });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "member:invite");

    const body = await req.json();
    const data = AddMemberSchema.parse(body);

    const user = await db.user.upsert({
      where: { email: data.email },
      update: { name: data.name },
      create: { name: data.name, email: data.email },
    });

    const membership = await db.membership.upsert({
      where: {
        householdId_userId: {
          householdId,
          userId: user.id,
        },
      },
      update: { role: data.role, status: "ACTIVE" },
      create: {
        householdId,
        userId: user.id,
        role: data.role,
        status: "ACTIVE",
      },
      include: { user: true },
    });

    return NextResponse.json({
      member: {
        id: membership.id,
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        status: membership.status,
      },
    }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation Error", details: err }, { status: 400 });
    }
    return handleAuthError(err);
  }
}
