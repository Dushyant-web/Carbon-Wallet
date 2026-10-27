import { NextResponse } from "next/server";
import { handleAuthError } from "@/server/auth/guard";
import { LocationError } from "./mohalla.service";

export function locationErrorResponse(err: unknown) {
  if (err instanceof LocationError) return NextResponse.json({ error: err.message }, { status: err.status });
  return handleAuthError(err);
}
