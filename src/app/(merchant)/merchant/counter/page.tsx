import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { MerchantCounter } from "@/components/merchant/MerchantCounter";

export const metadata = { title: "Counter" };

export default async function Page() {
  const user = await getCurrentUser();
  const merchant = user ? await db.merchant.findUnique({ where: { userId: user.id } }) : null;
  if (!merchant) redirect("/merchant/login"); // the layout has already sent everyone else elsewhere
  return <MerchantCounter shop={merchant.businessName} sells={merchant.sells} />;
}
