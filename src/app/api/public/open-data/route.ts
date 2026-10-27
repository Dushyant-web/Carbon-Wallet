import { NextResponse } from "next/server";
import { openData } from "@/server/services/openData.service";

export async function GET() {
  return NextResponse.json(await openData(), { headers: { "cache-control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
