import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/server/auth/guard";
import { listCatalogue } from "@/server/services/catalogue.service";
import { catalogueErrorResponse } from "@/server/services/catalogue.http";

/** The shop's products. ?active=1 for the counter's picker. */
export async function GET(req: NextRequest) {
  try {
    const { merchant } = await requireMerchant(req);
    return NextResponse.json({ items: await listCatalogue(merchant.id, req.nextUrl.searchParams.get("active") === "1") });
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}
