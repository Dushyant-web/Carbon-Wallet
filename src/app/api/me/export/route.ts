import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { exportUserData } from "@/server/services/privacy.service";

/** Download everything we hold about you, as one JSON file. ?files=1 adds stored original bills (owners). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!(await rateLimit(`export:${user.id}`, 5, 60 * 60_000)).ok) return NextResponse.json({ error: "You can download your data a few times an hour. Try again later." }, { status: 429 });
    const data = await exportUserData(user.id, req.nextUrl.searchParams.get("files") === "1");
    const membership = await db.membership.findFirst({ where: { userId: user.id }, select: { householdId: true } });
    if (membership) await db.auditLog.create({ data: { householdId: membership.householdId, userId: user.id, action: "privacy.export", entity: "User", details: "downloaded their data" } });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="carbon-wallet-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
