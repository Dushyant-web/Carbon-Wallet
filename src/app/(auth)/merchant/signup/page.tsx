import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { ShopDetailsForm } from "@/components/merchant/ShopDetailsForm";
import { getCurrentUser } from "@/server/auth/session";
import { googleConfigured } from "@/server/auth/google";
import { db } from "@/server/db";

export const metadata = { title: "Register your shop" };

/**
 * Shops that are already set up go straight to their counter. A shop that signed in with Google but hasn't told
 * us about the shop yet gets just the shop's details to fill in.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (user?.platformRole === "MERCHANT") {
    if (await db.merchant.findUnique({ where: { userId: user.id }, select: { id: true } })) redirect("/merchant");
    return <ShopDetailsForm name={user.name} />;
  }
  return <AuthForm mode="merchant-signup" google={googleConfigured()} />;
}
