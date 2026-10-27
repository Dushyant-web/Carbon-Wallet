import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listSales } from "@/server/services/merchant.service";
import { SectionHeading } from "@/components/ui/Card";
import { Pager, PAGE_SIZE } from "@/components/ui/Pager";

export const metadata = { title: "Registered items" };

const STATUS: Record<string, { label: string; cls: string }> = {
  REGISTERED: { label: "On their home", cls: "text-success-text" },
  REJECTED: { label: "Owner said not theirs", cls: "text-critical-text" },
  REMOVED: { label: "Removed by owner (sold or scrapped)", cls: "text-ink-muted" },
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** What this shop registered, and whether each home kept it. Only the Carbon ID identifies the home. */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  const merchant = user ? await db.merchant.findUnique({ where: { userId: user.id } }) : null;
  if (!merchant) redirect("/merchant/login");
  const sales = await listSales(merchant.id, 5000);
  const rejected = sales.filter((s) => s.status === "REJECTED").length;
  const pages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number((await searchParams).page) || 1));
  const shown = sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <span className="label-caps">{merchant.businessName}</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">Registered items</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Everything your shop has registered to customers&apos; homes. Owners can remove an item that isn&apos;t theirs;
          Carbon Wallet reviews shops whose items are often turned down.
        </p>
      </header>
      <section>
        <SectionHeading index="01" title={`${sales.length} items`} meta={rejected ? `${rejected} turned down by owners` : undefined} />
        {sales.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Nothing yet. Items you register at the counter appear here.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps pb-2 font-medium">Date</th>
                  <th className="label-caps pb-2 font-medium">Item</th>
                  <th className="label-caps pb-2 font-medium">Home</th>
                  <th className="label-caps pb-2 font-medium">Invoice</th>
                  <th className="label-caps pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className="border-b border-border/70">
                    <td className="py-3 pr-3 whitespace-nowrap font-mono text-xs tabular-nums">{when(s.createdAt)}</td>
                    <td className="py-3 pr-3">{s.summary}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{s.carbonId ?? "Home deleted"}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{s.invoiceRef ?? "—"}</td>
                    <td className={`py-3 text-xs ${STATUS[s.status]?.cls ?? ""}`}>{STATUS[s.status]?.label ?? s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pages={pages} total={sales.length} linkPrefix="/merchant/sales?page=" />
          </div>
        )}
      </section>
    </div>
  );
}
