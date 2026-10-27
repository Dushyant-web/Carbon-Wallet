import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { heatMap } from "@/server/services/heatmap.service";

/** Carbon per person by mohalla (only areas of 20+ homes), for the heat map page and the apps. */
export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    return NextResponse.json(await heatMap());
  } catch (err) {
    return handleAuthError(err);
  }
}
