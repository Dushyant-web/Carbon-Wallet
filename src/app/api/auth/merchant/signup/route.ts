import { NextRequest } from "next/server";
import { registerUser, badRequest } from "@/server/auth/accounts";
import { rateLimit, clientIp } from "@/server/auth/rateLimit";
import { MerchantProfileSchema } from "@/lib/merchant";

/** A shop signs up; it can scan cards only after a platform admin approves it (/admin/merchants). */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`merchant-signup:${clientIp(req)}`, 5);
  if (!limit.ok) return badRequest(`Too many attempts. Try again in ${limit.retryAfterSec}s.`, 429);

  const body = await req.json().catch(() => null);
  const shop = MerchantProfileSchema.safeParse(body);
  if (!shop.success) return badRequest(shop.error.issues[0]?.message ?? "Enter the shop's details.");

  return registerUser(body, "MERCHANT", req.headers.get("user-agent"), (tx, userId) =>
    tx.merchant.create({ data: { userId, ...shop.data, gstin: shop.data.gstin ?? null } }),
  );
}
