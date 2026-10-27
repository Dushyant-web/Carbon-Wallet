import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAdmin } from "@/server/auth/guard";
import { adminMohallaCells } from "@/server/services/adminMap.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const out = await adminMohallaCells(id, req.nextUrl.searchParams.get("month"));
    if (!out) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(out);
  } catch (err) {
    return handleAuthError(err);
  }
}
