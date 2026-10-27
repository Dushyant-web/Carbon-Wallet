import { NextRequest } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { photoResponse, removalErrorResponse } from "@/server/services/removal.http";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; reqId: string; photoId: string }> }) {
  try {
    const { id, reqId, photoId } = await params;
    await requireMembership(req, id, "data:read");
    return await photoResponse(reqId, photoId, id);
  } catch (err) {
    return removalErrorResponse(err);
  }
}
