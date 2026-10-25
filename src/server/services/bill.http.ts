import { NextResponse } from "next/server";
import { handleAuthError } from "@/server/auth/guard";
import { EngineError } from "@/server/engine";
import { BillError } from "./bill.service";

/** Maps bill/engine failures to readable JSON errors; everything else goes through the auth handler. */
export function billErrorResponse(err: unknown) {
  if (err instanceof BillError) {
    return NextResponse.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
  }
  if (err instanceof EngineError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return handleAuthError(err);
}
