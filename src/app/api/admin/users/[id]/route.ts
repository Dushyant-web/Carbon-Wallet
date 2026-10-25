import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin, handleAuthError } from "@/server/auth/guard";

const PatchSchema = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "status must be ACTIVE or DISABLED" }, { status: 400 });
    if (id === admin.id) return NextResponse.json({ error: "You can't disable your own account." }, { status: 400 });

    const user = await db.user.update({ where: { id }, data: { status: parsed.data.status } });
    if (parsed.data.status === "DISABLED") {
      await db.session.deleteMany({ where: { userId: id } }); // sign them out everywhere
    }
    return NextResponse.json({ user: { id: user.id, status: user.status } });
  } catch (err) {
    return handleAuthError(err);
  }
}
