import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/server/auth/guard";
import { templateCsv } from "@/lib/catalogue";
import { catalogueErrorResponse } from "@/server/services/catalogue.http";

export async function GET(req: NextRequest) {
  try {
    const { merchant } = await requireMerchant(req);
    return new NextResponse(templateCsv(merchant.sells), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="carbon-wallet-catalogue-template.csv"' },
    });
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}
