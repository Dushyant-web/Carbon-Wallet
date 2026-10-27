import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { clearItemPhoto, setItemPhoto } from "@/server/services/catalogue.service";
import { catalogueErrorResponse } from "@/server/services/catalogue.http";

export const runtime = "nodejs";

/** Add or replace one product's photo (multipart field `image`). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { merchant } = await requireMerchant(req);
    if (!(await rateLimit(`catalogue-photo:${merchant.id}`, 60, 10 * 60_000)).ok) return NextResponse.json({ error: "Too many photos. Try again in a few minutes." }, { status: 429 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("image");
    if (!file || typeof file === "string") return NextResponse.json({ error: "Attach the photo as `image`." }, { status: 400 });
    const url = await setItemPhoto(merchant.id, (await params).id, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ imageUrl: url }, { status: 201 });
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { merchant } = await requireMerchant(req);
    await clearItemPhoto(merchant.id, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}
