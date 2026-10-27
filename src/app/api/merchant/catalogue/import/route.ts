import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { MAX_CSV_BYTES, MAX_IMAGES, importCatalogue } from "@/server/services/catalogue.service";
import { catalogueErrorResponse } from "@/server/services/catalogue.http";

export const runtime = "nodejs";

/** Multipart: `file` (the CSV) and any number of `images` whose names match the CSV's image column. */
export async function POST(req: NextRequest) {
  try {
    const { merchant } = await requireMerchant(req);
    if (!(await rateLimit(`catalogue-import:${merchant.id}`, 10, 10 * 60_000)).ok) {
      return NextResponse.json({ error: "Too many uploads. Try again in a few minutes." }, { status: 429 });
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ error: "Attach the CSV as `file`." }, { status: 400 });
    if (file.size > MAX_CSV_BYTES) return NextResponse.json({ error: "The CSV must be under 2 MB." }, { status: 413 });
    const files = (form!.getAll("images") as (File | string)[]).filter((f): f is File => typeof f !== "string");
    if (files.length > MAX_IMAGES) return NextResponse.json({ error: `Up to ${MAX_IMAGES} photos per upload.` }, { status: 400 });
    const images = new Map<string, Buffer>();
    for (const f of files) images.set(f.name.toLowerCase(), Buffer.from(await f.arrayBuffer()));
    const result = await importCatalogue(merchant, await file.text(), images);
    return NextResponse.json(result, { status: result.created + result.updated ? 201 : 400 });
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}
