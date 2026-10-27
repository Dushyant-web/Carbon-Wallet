import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { buildPassbook, householdIdForPublicToken } from "@/server/services/passbook.service";
import { rateLimit } from "@/server/auth/rateLimit";
import { InkFilterDefs, Stamp } from "@/components/passbook/Stamp";
import { categoryColor } from "@/lib/viz";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const id = await householdIdForPublicToken(token);
  return { title: id ? "Public carbon record" : "Record not found", robots: { index: false } };
}

export default async function PublicRecordPage({ params }: Props) {
  const { token } = await params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!(await rateLimit(`public-page:${ip}`, 60)).ok) notFound();

  const householdId = await householdIdForPublicToken(token);
  if (!householdId) notFound();
  const pb = await buildPassbook(householdId);

  const total = pb.current.totalKg || 1;
  const categories = Object.entries(pb.current.categories)
    .filter(([, kg]) => kg > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-canvas">
      <InkFilterDefs />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between px-5">
          <Link href="/" className="flex items-end gap-1.5">
            <span className="font-heading text-lg font-medium leading-none">Carbon Wallet</span>
            <span className="mb-[2px] h-1.5 w-1.5 bg-secondary" aria-hidden />
          </Link>
          <span className="label-caps">Public carbon record</span>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-8">
        {/* Identity */}
        <section className="border border-ink bg-canvas-card">
          <div className="border-b border-ink px-5 py-4" style={{ background: "linear-gradient(135deg,#2C4733,#16241B)" }}>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[rgba(235,211,155,.7)]">Carbon ID</span>
            <p className="cw-foil mt-1 font-mono text-xl font-semibold tracking-[0.12em] md:text-2xl">{pb.carbonId}</p>
          </div>
          <div className="px-5 py-5">
            <h1 className="font-heading text-3xl font-medium tracking-tight md:text-4xl">{pb.household.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {pb.household.city}, {pb.household.state} · household of {pb.household.size}
            </p>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-ink pt-4">
              <div>
                <span className="label-caps">Latest complete month · {pb.current.label}</span>
                <p className="mt-1 font-heading text-6xl font-medium leading-none tabular-nums">
                  {pb.current.totalKg}
                  <span className="ml-2 font-mono text-sm text-ink-muted">kg CO₂e</span>
                </p>
              </div>
              <dl className="flex gap-6 text-sm">
                <div>
                  <dt className="label-caps">Per person</dt>
                  <dd className="mt-1 font-mono tabular-nums">{pb.current.perPersonKg} kg</dd>
                </div>
                <div>
                  <dt className="label-caps">Vs last month</dt>
                  <dd className={`mt-1 font-mono tabular-nums ${pb.current.trendPct <= 0 ? "text-success-text" : "text-critical-text"}`}>
                    {pb.current.trendPct > 0 ? "+" : ""}
                    {pb.current.trendPct}%
                  </dd>
                </div>
              </dl>
            </div>

            {pb.inProgress && (
              <p className="mt-3 font-mono text-xs text-ink-muted">
                {pb.inProgress.label} so far: {pb.inProgress.totalKg} kg (month in progress, not compared)
              </p>
            )}

            {categories.length > 0 && (
              <>
                <div className="mt-5 flex h-2.5 w-full overflow-hidden" aria-hidden>
                  {categories.map(([cat, kg]) => (
                    <div key={cat} style={{ width: `${(kg / total) * 100}%`, backgroundColor: categoryColor(cat) }} />
                  ))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                  {categories.map(([cat, kg]) => (
                    <li key={cat} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5" style={{ backgroundColor: categoryColor(cat) }} />
                        {cat}
                      </span>
                      <span className="font-mono text-xs text-ink-muted tabular-nums">{Math.round((kg / total) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {/* Monthly entries */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between border-t border-ink pt-2">
            <h2 className="font-heading text-xl font-medium">Monthly entries</h2>
            <span className="label-caps">{pb.anchoredCount} anchored</span>
          </div>
          <ul className="mt-2">
            {[...pb.months].reverse().map((m) => (
              <li key={m.month} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/70 py-3">
                <span className="font-heading text-lg">{m.label}</span>
                <span className="text-right font-mono tabular-nums">
                  {m.totalKg} <span className="text-xs text-ink-muted">kg</span>
                </span>
                <span className="flex w-[118px] justify-end">
                  <Stamp
                    status={m.status}
                    sub={m.status === "ANCHORED" && m.batchId ? `batch #${m.batchId}` : undefined}
                    stampKey={m.month}
                    className="text-[10px]"
                  />
                </span>
              </li>
            ))}
            {pb.months.length === 0 && <li className="py-4 text-sm text-ink-muted">No entries yet.</li>}
          </ul>
          {!pb.engineReachable && (
            <p className="mt-3 font-mono text-[11px] text-ink-muted">Anchoring status is temporarily unavailable.</p>
          )}
        </section>

        {/* What this is */}
        <section className="mt-8 border-l-2 border-secondary bg-canvas-card px-5 py-4 text-sm leading-relaxed">
          <p className="font-semibold">What you&apos;re looking at</p>
          <p className="mt-1 text-ink-muted">
            This household chose to share its monthly carbon totals with this link. Names, members and personal
            data stay private. Months stamped <span className="font-semibold text-secondary">Sealed</span> are locked in a public
            record, so the numbers can&apos;t be quietly edited later. Figures are based on the home&apos;s bills and logs.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <p className="text-sm text-ink-muted">Want a passbook for your home?</p>
          <Link href="/signup" className="h-10 rounded-md bg-primary px-5 text-sm font-medium leading-10 text-primary-foreground hover:bg-primary-hover">
            Create a free account
          </Link>
        </div>
      </main>
    </div>
  );
}
