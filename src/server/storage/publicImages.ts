import { createHash } from "crypto";
import { supabaseKeyHeaders } from "./supabaseAuth";
import { db } from "@/server/db";
import type { CleanImage } from "./imageClean";

/*
 * Public product photos (a shop's own marketing pictures, safe to show to anyone):
 *   - production: a PUBLIC Supabase Storage bucket (SUPABASE_PUBLIC_BUCKET, default "product-images"), served by
 *     Supabase's CDN, so photos never go through our functions;
 *   - local / no Supabase: stored in the database and served by /api/catalogue/images/<id>.
 * Either way the bytes were checked to be a real JPEG/PNG and stripped of metadata first (imageClean.ts).
 * Private files (bills, removal photos) never go here: they use the encrypted store (encrypted.ts).
 */

function supabasePublic() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { base: url.replace(/\/$/, ""), key, bucket: process.env.SUPABASE_PUBLIC_BUCKET || "product-images" };
}

/** Saves a product photo and returns the URL to show it at. */
export async function saveProductImage(itemId: string, img: CleanImage): Promise<string> {
  const hash = createHash("sha256").update(img.data).digest("hex").slice(0, 12);
  const sb = supabasePublic();
  if (sb) {
    const ext = img.mime === "image/png" ? "png" : "jpg";
    const objectPath = `catalogue/${itemId}-${hash}.${ext}`;
    const res = await fetch(`${sb.base}/storage/v1/object/${sb.bucket}/${objectPath}`, {
      method: "POST",
      headers: { ...supabaseKeyHeaders(sb.key), "content-type": img.mime, "x-upsert": "true", "cache-control": "max-age=31536000" },
      body: new Uint8Array(img.data),
    });
    if (!res.ok) throw new Error(`photo upload failed (${res.status})`);
    const url = `${sb.base}/storage/v1/object/public/${sb.bucket}/${objectPath}`;
    await db.catalogueImage.deleteMany({ where: { itemId } });
    await db.catalogueItem.update({ where: { id: itemId }, data: { imageUrl: url } });
    return url;
  }
  await db.catalogueImage.upsert({
    where: { itemId },
    create: { itemId, mimeType: img.mime, sizeBytes: img.data.length, data: new Uint8Array(img.data) },
    update: { mimeType: img.mime, sizeBytes: img.data.length, data: new Uint8Array(img.data) },
  });
  const url = `/api/catalogue/images/${itemId}?v=${hash}`; // a new photo gets a new URL, so caches never show the old one
  await db.catalogueItem.update({ where: { id: itemId }, data: { imageUrl: url } });
  return url;
}

export async function removeProductImage(itemId: string) {
  await db.catalogueImage.deleteMany({ where: { itemId } });
  await db.catalogueItem.update({ where: { id: itemId }, data: { imageUrl: null } });
}
