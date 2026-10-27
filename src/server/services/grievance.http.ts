import { NextResponse } from "next/server";
import { handleAuthError } from "@/server/auth/guard";
import { GrievanceError } from "./grievance.service";

export function grievanceErrorResponse(err: unknown) {
  if (err instanceof GrievanceError) return NextResponse.json({ error: err.message }, { status: err.status });
  return handleAuthError(err);
}
