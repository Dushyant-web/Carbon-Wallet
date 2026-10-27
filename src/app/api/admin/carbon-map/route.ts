import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAdmin } from "@/server/auth/guard";
import { adminCarbonMap } from "@/server/services/adminMap.service";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json(await adminCarbonMap(req.nextUrl.searchParams.get("month")));
  } catch (err) {
    return handleAuthError(err);
  }
}
