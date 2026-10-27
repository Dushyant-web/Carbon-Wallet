import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/server/auth/guard";
import { merchantDashboard } from "@/server/services/catalogue.service";
import { catalogueErrorResponse } from "@/server/services/catalogue.http";

export async function GET(req: NextRequest) {
  try {
    const { merchant } = await requireMerchant(req);
    return NextResponse.json(await merchantDashboard(merchant));
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}
