import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guard";
import { adminQueue } from "@/server/services/removal.service";
import { removalErrorResponse } from "@/server/services/removal.http";

/** Removal requests and "Not ours" disputes, oldest pending first. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const s = req.nextUrl.searchParams.get("status");
    const status = s === "APPROVED" || s === "REJECTED" ? s : "PENDING";
    return NextResponse.json({ requests: await adminQueue(status) });
  } catch (err) {
    return removalErrorResponse(err);
  }
}
