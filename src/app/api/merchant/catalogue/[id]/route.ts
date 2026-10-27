import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchant } from "@/server/auth/guard";
import { deleteItem, setItemActive } from "@/server/services/catalogue.service";
import { catalogueErrorResponse } from "@/server/services/catalogue.http";

const Body = z.object({ active: z.boolean() }).strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { merchant } = await requireMerchant(req);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Send { active: true | false }" }, { status: 400 });
    await setItemActive(merchant.id, (await params).id, parsed.data.active);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { merchant } = await requireMerchant(req);
    await deleteItem(merchant.id, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return catalogueErrorResponse(err);
  }
}
