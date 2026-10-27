import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guard";
import { respond } from "@/server/services/grievance.service";
import { grievanceErrorResponse } from "@/server/services/grievance.http";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    return NextResponse.json(await respond((await params).id, admin.id, await req.json().catch(() => null)));
  } catch (err) {
    return grievanceErrorResponse(err);
  }
}
