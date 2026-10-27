import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { handleAuthError, requireAdmin } from "@/server/auth/guard";
import { ensureSchemes, publicScheme } from "@/server/services/scheme.service";

/** The scheme catalogue with how often each was explained or applied for. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    await ensureSchemes();
    const rows = await db.scheme.findMany({ orderBy: { name: "asc" }, include: { help: { select: { status: true } } } });
    return NextResponse.json({
      schemes: rows.map((s) => ({
        ...publicScheme(s),
        explained: s.help.filter((h) => h.status === "EXPLAINED").length,
        applied: s.help.filter((h) => h.status === "APPLIED").length,
      })),
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
