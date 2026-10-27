import { NextResponse } from "next/server";
import { handleAuthError } from "@/server/auth/guard";
import { MerchantError } from "./merchant.service";

/** Maps counter failures to readable JSON errors; everything else goes through the auth handler. */
export function merchantErrorResponse(err: unknown) {
  if (err instanceof MerchantError) return NextResponse.json({ error: err.message }, { status: err.status });
  return handleAuthError(err);
}
