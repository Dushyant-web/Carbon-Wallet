import { NextResponse } from "next/server";
import { handleAuthError } from "@/server/auth/guard";
import { RemovalError, photoFor } from "./removal.service";

export function removalErrorResponse(err: unknown) {
  if (err instanceof RemovalError) return NextResponse.json({ error: err.message }, { status: err.status });
  return handleAuthError(err);
}

/** Streams a removal photo. Never cached by shared caches, never sniffed as anything but an image. */
export async function photoResponse(requestId: string, photoId: string, householdId?: string) {
  const p = await photoFor(requestId, photoId);
  if (!p || (householdId && p.householdId !== householdId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(p.data), {
    headers: {
      "content-type": p.mime,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}
