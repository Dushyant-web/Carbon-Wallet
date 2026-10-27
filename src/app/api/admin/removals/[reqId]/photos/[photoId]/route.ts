import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/auth/guard";
import { photoResponse, removalErrorResponse } from "@/server/services/removal.http";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ reqId: string; photoId: string }> }) {
  try {
    await requireAdmin(req);
    const { reqId, photoId } = await params;
    return await photoResponse(reqId, photoId);
  } catch (err) {
    return removalErrorResponse(err);
  }
}
