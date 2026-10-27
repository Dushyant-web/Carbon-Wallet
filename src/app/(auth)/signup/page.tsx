import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/server/auth/session";
import { googleConfigured } from "@/server/auth/google";

export const metadata = { title: "Create account" };

/** Already signed in? Go straight to the app instead of asking again. */
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) {
    const next = (await searchParams).next;
    redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }
  return <AuthForm mode="signup" google={googleConfigured()} />;
}
