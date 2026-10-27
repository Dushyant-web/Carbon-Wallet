import { NextRequest, NextResponse } from "next/server";
import { catalogueImage } from "@/server/services/catalogue.service";

export const runtime = "nodejs";

/** Product photos are the shop's own marketing pictures: public, cached, never sniffed as anything but an image. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const img = await catalogueImage((await params).itemId);
  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(img.data), {
    headers: { "content-type": img.mimeType, "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff", "content-disposition": "inline" },
  });
}
