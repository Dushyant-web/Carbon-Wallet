import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/server/auth/session";
import { googleConfigured } from "@/server/auth/google";

export const metadata = { title: "Shop log in" };

/** Shops that are already signed in go straight to their counter. */
export default async function Page() {
  const user = await getCurrentUser();
  if (user?.platformRole === "MERCHANT") redirect("/merchant");
  return <AuthForm mode="merchant-login" google={googleConfigured()} />;
}
