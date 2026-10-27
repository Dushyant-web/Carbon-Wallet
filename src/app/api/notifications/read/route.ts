import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { markRead } from "@/server/services/notifications.service";

const Body = z.union([z.object({ all: z.literal(true) }).strict(), z.object({ ids: z.array(z.string().max(40)).min(1).max(100) }).strict()]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Send { all: true } or { ids: [...] }" }, { status: 400 });
    const marked = await markRead(user.id, "all" in parsed.data ? "all" : parsed.data.ids);
    return NextResponse.json({ marked });
  } catch (err) {
    return handleAuthError(err);
  }
}
