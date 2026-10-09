import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { z } from "zod";

const JoinSchema = z.object({
  code: z.string().min(4),
  userId: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, userId, name, email } = JoinSchema.parse(body);

    const household = await db.household.findUnique({
      where: { joinCode: code.trim().toUpperCase() },
    });

    if (!household) {
      return NextResponse.json({ error: "Invalid household join code" }, { status: 404 });
    }

    // Resolve or create user
    let user = null;
    if (userId) {
      user = await db.user.findUnique({ where: { id: userId } });
    } else if (email) {
      user = await db.user.upsert({
        where: { email },
        update: { name: name || undefined },
        create: { name: name || "New Member", email },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "User identity required to join household" },
        { status: 400 }
      );
    }

    // Upsert membership
    const membership = await db.membership.upsert({
      where: {
        householdId_userId: {
          householdId: household.id,
          userId: user.id,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        householdId: household.id,
        userId: user.id,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      message: `Successfully joined ${household.name}`,
      household,
      membership,
    });
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation Error", details: err }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
