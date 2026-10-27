import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { fileGrievance, myGrievances } from "@/server/services/grievance.service";
import { grievanceErrorResponse } from "@/server/services/grievance.http";

/** Your own tickets. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ tickets: await myGrievances(user.id) });
  } catch (err) {
    return grievanceErrorResponse(err);
  }
}

/** File a complaint or ask for help: you get a ticket number. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!(await rateLimit(`grievance:${user.id}`, 5, 60 * 60_000)).ok) return NextResponse.json({ error: "You've filed several already. Try again in an hour." }, { status: 429 });
    return NextResponse.json(await fileGrievance(user, await req.json().catch(() => null)), { status: 201 });
  } catch (err) {
    return grievanceErrorResponse(err);
  }
}
