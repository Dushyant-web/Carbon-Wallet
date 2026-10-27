import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { mohallaView } from "@/server/services/mohalla.service";
import { locationErrorResponse } from "@/server/services/mohalla.http";

/** My mohalla vs city vs state vs India, the area's weather and air, and today's feed. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "data:read");
    return NextResponse.json(await mohallaView(id));
  } catch (err) {
    return locationErrorResponse(err);
  }
}
