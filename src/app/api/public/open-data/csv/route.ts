import { NextResponse } from "next/server";
import { openDataCsv } from "@/server/services/openData.service";

/** Area totals as CSV (only areas with enough homes), free to reuse with attribution. */
export async function GET() {
  return new NextResponse(await openDataCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="carbon-wallet-area-totals.csv"',
      "cache-control": "public, s-maxage=900",
    },
  });
}
