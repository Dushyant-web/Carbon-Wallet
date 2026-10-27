import { NextResponse } from "next/server";
import { CatalogueError } from "./catalogue.service";
import { merchantErrorResponse } from "./merchant.http";

export function catalogueErrorResponse(err: unknown) {
  if (err instanceof CatalogueError) return NextResponse.json({ error: err.message }, { status: err.status });
  return merchantErrorResponse(err);
}
