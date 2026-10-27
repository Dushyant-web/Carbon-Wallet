"use client";

import { Pager, usePaged } from "@/components/ui/Pager";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Cell } from "@/components/admin/CellMap";

const CellMap = dynamic(() => import("@/components/admin/CellMap").then((m) => m.CellMap), { ssr: false, loading: () => <div className="h-[420px] animate-pulse bg-canvas-subtle" /> });

type Official = { name: string; perCapitaT: number; year: number; monthlyKg: number; source: string; url: string; scope: string };
type MapData = {
  month: string | null;
  minHomes: number;
  kpis: { homes: number; demoHomes: number; shops: number; mohallas: number; cities: number; sealedDays: number; indiaKgPerPerson: number | null };
  states: { code: string; name: string; x: number; y: number; homes: number; kgPerPerson: number | null; shareable: boolean; estimateKg: number; official: { perCapitaT: number; monthlyKg: number; year: number } | null }[];
  cities: { name: string; state: string; homes: number; kgPerPerson: number }[];
  mohallas: { id: string; name: string; city: string; state: string; homes: number; kgPerPerson: number | null }[];
  official: { india: Official; up: Official; noida: Official; inventory: { year: number; totalMt: number; netWithForestsMt: number; sectorsPct: { en: string; pct: number }[]; source: string; url: string } };
};
type CellsData = {
  mohalla: { id: string; name: string; city: string; state: string; homes: number; center: [number, number] };
  average: { perPersonKg: number; source: string; homes: number };
  counts: Record<"GREEN" | "AMBER" | "RED" | "NONE", number>;
  cells: Cell[];
  outline: [number, number][][];
};

const TILE = 58;

export default function AdminMapPage() {
  const { data, isLoading } = useQuery<MapData>({
    queryKey: ["admin", "carbon-map"],
    queryFn: async () => {
      const res = await fetch("/api/admin/carbon-map");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });
  const [picked, setPicked] = useState<string | null>(null);
  const mohallaId = picked ?? data?.mohallas[0]?.id ?? null;
  const cells = useQuery<CellsData>({
    queryKey: ["admin", "carbon-map", "mohalla", mohallaId, data?.month],
    queryFn: async () => {
      const res = await fetch(`/api/admin/carbon-map/mohallas/${mohallaId}${data?.month ? `?month=${data.month}` : ""}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!mohallaId,
  });

  const mohallaPages = usePaged(data?.mohallas ?? []);
  const cityPages = usePaged(data?.cities ?? []);

  if (isLoading || !data) return <Skeleton className="h-[600px] w-full" />;
  const shown = data.states.filter((s) => s.shareable && s.kgPerPerson !== null).map((s) => s.kgPerPerson!);
  const maxKg = Math.max(1, ...shown);
  const cols = Math.max(...data.states.map((s) => s.x)) + 1;
  const rows = Math.max(...data.states.map((s) => s.y)) + 1;
  const c = cells.data;
  const total = c ? c.counts.GREEN + c.counts.AMBER + c.counts.RED : 0;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <span className="label-caps">Platform admin</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">Carbon map of India</h1>
        <p className="mt-3 max-w-3xl text-sm text-ink-muted">
          Where Carbon Wallet homes are and how they&apos;re doing, next to the official figures. Month: <strong>{data.month ?? "—"}</strong>. Areas with fewer than{" "}
          {data.minHomes} homes are greyed for households; admins see each home only as a ~120 m hexagon, never a name or an exact point.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["Homes", data.kpis.homes, data.kpis.demoHomes ? `${data.kpis.demoHomes} example homes` : "all signed up"],
          ["Mohallas", data.kpis.mohallas, ""],
          ["Cities", data.kpis.cities, `month ${data.month ?? "—"}`],
          ["Approved shops", data.kpis.shops, ""],
          ["Days sealed on chain", data.kpis.sealedDays, ""],
          ["Carbon Wallet homes", data.kpis.indiaKgPerPerson !== null ? `${data.kpis.indiaKgPerPerson} kg` : "—", "per person, direct, this month"],
          ["India, official", `${data.official.india.monthlyKg} kg`, `per person a month (${data.official.india.year}, all sectors)`],
        ].map(([label, value, sub]) => (
          <div key={String(label)} className="border border-border bg-canvas-card p-4">
            <p className="label-caps">{label}</p>
            <p className="mt-1 font-heading text-3xl font-medium tabular-nums">{value}</p>
            {sub ? <p className="text-[11px] text-ink-muted">{sub}</p> : null}
          </div>
        ))}
      </section>

      {/* Mohalla map */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-heading text-2xl font-medium">Mohalla map</h2>
            <label className="flex items-center gap-2 text-sm">
              <span className="label-caps">Mohalla</span>
              <select value={mohallaId ?? ""} onChange={(e) => setPicked(e.target.value)} className="h-9 rounded-md border border-border bg-canvas-card px-2 text-sm">
                {data.mohallas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.homes})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3">{c ? <CellMap cells={c.cells} outline={c.outline} center={c.mohalla.center} /> : <div className="h-[420px] animate-pulse bg-canvas-subtle" />}</div>
          {c && (
            <div className="mt-3">
              <div className="flex h-4 w-full overflow-hidden" aria-hidden>
                <span className="bg-success" style={{ width: `${(c.counts.GREEN / Math.max(1, total)) * 100}%` }} />
                <span className="bg-warning" style={{ width: `${(c.counts.AMBER / Math.max(1, total)) * 100}%` }} />
                <span className="bg-critical" style={{ width: `${(c.counts.RED / Math.max(1, total)) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[13px]">
                <strong className="text-success-text">{c.counts.GREEN} green</strong> · <strong className="text-warning-text">{c.counts.AMBER} amber</strong> ·{" "}
                <strong className="text-critical-text">{c.counts.RED} red</strong>
                {c.counts.NONE ? ` · ${c.counts.NONE} without data` : ""} — against the allowance of {c.average.perPersonKg} kg per person.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-2xl font-medium">Mohallas</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps pb-2 font-medium">Mohalla</th>
                <th className="label-caps pb-2 text-right font-medium">Homes</th>
                <th className="label-caps pb-2 text-right font-medium">kg / person</th>
              </tr>
            </thead>
            <tbody>
              {mohallaPages.slice.map((m) => (
                <tr key={m.id} className={`cursor-pointer border-b border-border/70 hover:bg-canvas-subtle ${m.id === mohallaId ? "bg-gov-sky" : ""}`} onClick={() => setPicked(m.id)}>
                  <td className="py-2">{m.name}</td>
                  <td className="py-2 text-right tabular-nums">{m.homes}</td>
                  <td className="py-2 text-right tabular-nums">{m.kgPerPerson ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={mohallaPages.page} pages={mohallaPages.pages} total={mohallaPages.total} onPage={mohallaPages.setPage} />
          <h3 className="mt-2 font-heading text-xl font-medium">Cities</h3>
          <table className="w-full text-sm">
            <tbody>
              {cityPages.slice.map((ct) => (
                <tr key={`${ct.name}|${ct.state}`} className="border-b border-border/70">
                  <td className="py-1.5">
                    {ct.name} <span className="text-ink-muted">{ct.state}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {ct.homes} {ct.homes === 1 ? "home" : "homes"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{ct.kgPerPerson} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={cityPages.page} pages={cityPages.pages} total={cityPages.total} onPage={cityPages.setPage} />
        </div>
      </section>

      {/* India tile grid */}
      <section className="grid grid-cols-1 gap-8 xl:grid-cols-[auto_1fr]">
        <div>
          <h2 className="font-heading text-2xl font-medium">States</h2>
          <p className="text-[13px] text-ink-muted">kg CO₂e per person this month, Carbon Wallet homes. A tile grid, not a map.</p>
          <svg width={cols * TILE + 2} height={rows * TILE + 2} className="mt-3 max-w-full" role="img" aria-label="Tile grid of Indian states">
            {data.states.map((s) => {
              const v = s.shareable && s.kgPerPerson !== null ? s.kgPerPerson / maxKg : null;
              const fill = v === null ? "#ECE7DC" : `rgba(18, 40, 76, ${0.25 + v * 0.75})`;
              return (
                <g key={s.code} transform={`translate(${s.x * TILE + 1}, ${s.y * TILE + 1})`}>
                  <title>
                    {`${s.name}: ${s.homes} homes${s.kgPerPerson !== null ? `, ${s.kgPerPerson} kg/person` : ""}; starting estimate ${s.estimateKg} kg${s.official ? `; official ${s.official.perCapitaT} t/yr (${s.official.year}) = ${s.official.monthlyKg} kg/month` : ""}`}
                  </title>
                  <rect width={TILE - 4} height={TILE - 4} rx={3} fill={fill} stroke={s.homes ? "#12284C" : "#DCD5C6"} />
                  <text x={(TILE - 4) / 2} y={20} textAnchor="middle" fontSize={12} fontWeight={600} fill={v !== null && v > 0.4 ? "#fff" : "#1D1C18"}>
                    {s.code}
                  </text>
                  <text x={(TILE - 4) / 2} y={38} textAnchor="middle" fontSize={11} fill={v !== null && v > 0.4 ? "#fff" : "#625D54"}>
                    {s.kgPerPerson !== null && s.shareable ? Math.round(s.kgPerPerson) : s.homes ? `${s.homes}h` : "—"}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-2 text-[11px] text-ink-muted">Number = kg per person; “3h” = homes, below the {data.minHomes}-home minimum to show a figure.</p>
        </div>

        <div>
          <h2 className="font-heading text-2xl font-medium">India&apos;s official inventory ({data.official.inventory.year})</h2>
          <p className="text-[13px] text-ink-muted">
            {data.official.inventory.totalMt.toLocaleString("en-IN")} Mt CO₂e without forests and land use; {data.official.inventory.netWithForestsMt.toLocaleString("en-IN")} Mt with them.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {data.official.inventory.sectorsPct.map((s) => (
              <li key={s.en}>
                <div className="flex justify-between text-[13px]">
                  <span>{s.en}</span>
                  <strong className="tabular-nums">{s.pct}%</strong>
                </div>
                <div className="mt-1 h-3 bg-canvas-subtle">
                  <div className="h-full bg-gov-navy" style={{ width: `${s.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <a href={data.official.inventory.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] underline">
            {data.official.inventory.source} <ExternalLink className="h-3 w-3" />
          </a>
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps pb-2 font-medium">Published figure</th>
                <th className="label-caps pb-2 text-right font-medium">t / person / year</th>
                <th className="label-caps pb-2 text-right font-medium">kg / month</th>
              </tr>
            </thead>
            <tbody>
              {[data.official.india, data.official.up, data.official.noida].map((o) => (
                <tr key={o.name} className="border-b border-border/70 align-top">
                  <td className="py-2">
                    {o.name} ({o.year})
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-ink-muted underline">
                      {o.scope} · {o.source}
                    </a>
                  </td>
                  <td className="py-2 text-right tabular-nums">{o.perCapitaT}</td>
                  <td className="py-2 text-right tabular-nums">{o.monthlyKg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
