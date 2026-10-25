import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "Admin log in" };

/** Admins who are already signed in go straight to the admin panel. */
export default async function Page() {
  const user = await getCurrentUser();
  if (user?.platformRole === "ADMIN") redirect("/admin");
  return <AuthForm mode="admin-login" />;
}
