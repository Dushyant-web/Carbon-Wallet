import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.platformRole !== "ADMIN") redirect("/dashboard?denied=admin");

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:px-10">
          <div className="flex items-end gap-6">
            <Link href="/admin" className="flex items-end gap-2 pb-0.5">
              <span className="font-heading text-[1.35rem] font-medium leading-none">Carbon Wallet</span>
              <span className="label-caps">Admin</span>
            </Link>
            <nav className="hidden md:flex gap-5 text-sm">
              <Link href="/admin" className="text-ink-muted hover:text-ink">Overview</Link>
              <Link href="/admin/households" className="text-ink-muted hover:text-ink">Households</Link>
              <Link href="/admin/merchants" className="text-ink-muted hover:text-ink">Merchants</Link>
              <Link href="/admin/reader" className="text-ink-muted hover:text-ink">Card reader</Link>
              <Link href="/dashboard" className="text-ink-muted hover:text-ink">Open app</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-ink-muted">{user.email}</span>
            <LogoutButton redirectTo="/admin/login" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 md:px-10 py-8">{children}</main>
    </div>
  );
}
