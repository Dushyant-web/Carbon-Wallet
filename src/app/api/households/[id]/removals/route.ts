import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { MAX_PHOTOS, createRemoval, listForHousehold } from "@/server/services/removal.service";
import { removalErrorResponse } from "@/server/services/removal.http";

export const runtime = "nodejs";

/** This home's removal requests and what was decided. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "data:read");
    return NextResponse.json({ requests: await listForHousehold(id) });
  } catch (err) {
    return removalErrorResponse(err);
  }
}

/** Multipart: kind, itemId, reason, note, and up to three `photos`. Owner only; an admin decides. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "asset:delete");
    const limit = await rateLimit(`removal:${id}`, 10, 60 * 60_000);
    if (!limit.ok) return NextResponse.json({ error: `Too many requests. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` }, { status: 429 });
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Send the form as multipart." }, { status: 400 });
    const files = form.getAll("photos").filter((f): f is File => typeof f !== "string");
    if (files.length > MAX_PHOTOS) return NextResponse.json({ error: `Up to ${MAX_PHOTOS} photos.` }, { status: 400 });
    const photos = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    const input = { kind: form.get("kind"), itemId: form.get("itemId"), reason: form.get("reason"), note: form.get("note") };
    return NextResponse.json(await createRemoval(id, auth.userId, input, photos), { status: 201 });
  } catch (err) {
    return removalErrorResponse(err);
  }
}
