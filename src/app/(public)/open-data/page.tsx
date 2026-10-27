import { ExternalLink, FileDown, ShieldCheck } from "lucide-react";
import { openData } from "@/server/services/openData.service";
import { Pager, PAGE_SIZE } from "@/components/ui/Pager";

export const metadata = { title: "Open data & sealed records" };
export const dynamic = "force-dynamic"; // read at request time, never at build time

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Public: what Carbon Wallet publishes, where its figures come from, and the daily seals anyone can check. */
export default async function OpenDataPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const d = await openData();
  const latest = d.area[0]?.month ?? null;
  const allRows = d.area.filter((a) => a.month === latest);
  const pages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number((await searchParams).page) || 1));
  const latestRows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-10">
      <header className="border-b-[3px] border-gov-saffron pb-4">
        <span className="label-caps">Transparency</span>
        <h1 className="mt-1.5 font-heading text-4xl font-medium tracking-tight">Open data &amp; sealed records</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
          What Carbon Wallet publishes, where every figure comes from, and a public register of what was sealed on the blockchain each day. Area
          totals appear only when at least {d.minHomes} homes contribute, so no single home can be picked out. Free to reuse with attribution.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Homes", d.stats.homes],
          ["Registered shops", d.stats.shops],
          ["Mohallas", d.stats.mohallas],
          ["Days sealed on chain", d.stats.sealedDays],
          ["Data last updated", d.stats.lastUpdated ? day(d.stats.lastUpdated) : "—"],
        ].map(([l, v]) => (
          <div key={String(l)} className="border border-border bg-canvas-card p-4">
            <p className="label-caps">{l}</p>
            <p className="mt-1 font-heading text-2xl font-medium tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl font-medium">Area totals{latest ? `, ${latest}` : ""}</h2>
            <p className="text-[13px] text-ink-muted">kg of CO₂ per person in the month, from what Carbon Wallet homes burn directly (electricity, cooking gas, vehicles).</p>
          </div>
          <a href="/api/public/open-data/csv" className="inline-flex h-10 items-center gap-2 rounded-md bg-gov-navy px-4 text-[13px] font-semibold text-white">
            <FileDown className="h-4 w-4" /> Download all months (CSV)
          </a>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gov-navy text-left">
              <th className="pb-2 font-semibold">Area</th>
              <th className="pb-2 font-semibold">Level</th>
              <th className="pb-2 text-right font-semibold">Homes</th>
              <th className="pb-2 text-right font-semibold">People</th>
              <th className="pb-2 text-right font-semibold">kg / person</th>
            </tr>
          </thead>
          <tbody>
            {latestRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-ink-muted">No area has {d.minHomes} homes yet.</td>
              </tr>
            ) : (
              latestRows.map((a) => (
                <tr key={`${a.level}${a.name}`} className="border-b border-border/70 odd:bg-canvas-card">
                  <td className="py-2">{a.name}</td>
                  <td className="py-2 font-mono text-[12px] text-ink-muted">{a.level.toLowerCase()}</td>
                  <td className="py-2 text-right tabular-nums">{a.homes}</td>
                  <td className="py-2 text-right tabular-nums">{a.people}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{a.kgPerPerson}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pager page={page} pages={pages} total={allRows.length} linkPrefix="/open-data?page=" />
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-medium">
          <ShieldCheck className="h-6 w-6 text-gov-green" /> Daily seal register
        </h2>
        <p className="max-w-3xl text-[13px] text-ink-muted">
          Every night the day&apos;s shop registrations, removal decisions, scheme help and area totals are hashed into one Merkle root and sealed on
          the blockchain. Only the root is public; anyone holding a record can prove it was included and not changed. Monthly home statements are
          sealed the same way and can be checked on the <a className="underline" href="/proof">record check</a> page.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gov-navy text-left">
              <th className="pb-2 font-semibold">Day</th>
              <th className="pb-2 text-right font-semibold">Records</th>
              <th className="pb-2 font-semibold">Merkle root</th>
              <th className="pb-2 font-semibold">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {d.seals.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-ink-muted">The first daily seal runs tonight.</td>
              </tr>
            ) : (
              d.seals.map((s) => (
                <tr key={s.day} className="border-b border-border/70">
                  <td className="py-2">{s.day}</td>
                  <td className="py-2 text-right tabular-nums">{s.records}</td>
                  <td className="max-w-[260px] truncate py-2 font-mono text-[12px]">{s.root}</td>
                  <td className="max-w-[260px] truncate py-2 font-mono text-[12px]">{s.txHash ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div>
          <h2 className="font-heading text-2xl font-medium">Official figures we compare with</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {d.official.map((o) => (
              <li key={o.key} className="border-l-4 border-gov-navy bg-canvas-card px-4 py-3">
                <p className="text-[15px] font-semibold">
                  {o.name} ({o.year}): {o.perCapitaT} t per person a year ≈ {o.monthlyKg} kg a month
                </p>
                <p className="text-[13px] text-ink-muted">{o.scope}.</p>
                {o.caveat && <p className="text-[12px] text-ink-muted">{o.caveat}</p>}
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] underline">
                  {o.source} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
            <li className="border-l-4 border-gov-navy bg-canvas-card px-4 py-3">
              <p className="text-[15px] font-semibold">
                India&apos;s national inventory ({d.inventory.year}): {d.inventory.totalMt.toLocaleString("en-IN")} Mt CO₂e
              </p>
              <p className="text-[13px] text-ink-muted">{d.inventory.sectorsPct.map((s) => `${s.en.split(" (")[0]} ${s.pct}%`).join(" · ")}</p>
              <a href={d.inventory.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] underline">
                {d.inventory.source} <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-heading text-2xl font-medium">Government schemes: where the terms come from</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {d.schemes.map((s) => (
                <tr key={s.name} className="border-b border-border/70 align-top">
                  <td className="py-2">
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                      {s.name}
                    </a>
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-ink-muted underline">
                      source of the current terms
                    </a>
                  </td>
                  <td className="py-2 text-right text-[12px] text-ink-muted">checked {day(s.lastChecked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-[13px] text-ink-muted">
            All greenhouse gases are counted, as CO₂e (IPCC AR6, 100-year): electricity 0.678 kg CO₂e per unit (CEA CO₂ Baseline
            Database v22, FY 2025-26, plus the CH₄ and N₂O from burning the coal), petrol 2.37 kg/L, diesel 2.72 kg/L, CNG 2.92 kg/kg,
            LPG 2.99 kg/kg, AC refrigerant leaks at their HFC warming factor. Full method: <a href="/methodology" className="underline">Method &amp; sources</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
