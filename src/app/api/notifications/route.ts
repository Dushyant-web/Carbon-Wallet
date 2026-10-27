import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { listNotifications } from "@/server/services/notifications.service";

/** Your notifications, 20 a page, with the unread count for the bell. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const page = Number(req.nextUrl.searchParams.get("page") ?? 1) || 1;
    return NextResponse.json(await listNotifications(user.id, page), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return handleAuthError(err);
  }
}
