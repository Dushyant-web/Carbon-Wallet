import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guard";
import { adminGrievances } from "@/server/services/grievance.service";
import { grievanceErrorResponse } from "@/server/services/grievance.http";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const s = req.nextUrl.searchParams.get("status");
    return NextResponse.json({ tickets: await adminGrievances(s && ["OPEN", "IN_PROGRESS", "RESOLVED"].includes(s) ? s : undefined) });
  } catch (err) {
    return grievanceErrorResponse(err);
  }
}
