import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { handleAuthError, requireAdmin } from "@/server/auth/guard";

const Body = z
  .object({
    status: z.enum(["ACTIVE", "CHECK", "HIDDEN"]).optional(),
    benefit: z.string().trim().min(5).max(400).optional(),
    benefitHi: z.string().trim().min(2).max(400).optional(),
    markChecked: z.literal(true).optional(),
  })
  .strict();

/** Admin keeps a scheme current: show / hide it, edit the benefit line, or record that the terms were re-checked today. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { slug } = await params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid change" }, { status: 400 });
    const { markChecked, ...rest } = parsed.data;
    const scheme = await db.scheme.findUnique({ where: { slug } });
    if (!scheme) return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
    const updated = await db.scheme.update({
      where: { slug },
      data: { ...rest, ...(markChecked ? { lastChecked: new Date(), status: rest.status ?? (scheme.status === "CHECK" ? "ACTIVE" : scheme.status) } : {}) },
    });
    console.info(`[admin] ${admin.email} updated scheme ${slug}`, Object.keys(parsed.data).join(","));
    return NextResponse.json({ ok: true, status: updated.status, lastChecked: updated.lastChecked.toISOString() });
  } catch (err) {
    return handleAuthError(err);
  }
}
