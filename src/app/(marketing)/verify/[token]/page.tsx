"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Upload, XCircle } from "lucide-react";
import { engine, type VerifyResult } from "@/lib/engine";
import type { PublicShare, SharedMonth } from "@/server/services/share.service";

/*
 * What a bank, employer or housing society sees when a household shares sealed months. Each month can be
 * checked here against the public record, by anyone, with no account. Never shows names, cards or bills.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
const chainName = (c: string) => (c === "local-devnet" ? "a local test record (not a public chain)" : c.replace(/-/g, " "));

type Check = VerifyResult | "checking" | "error";

function Verdict({ check }: { check: Check | undefined }) {
  if (!check) return null;
  if (check === "checking") return <p className="text-sm text-ink-muted">Checking…</p>;
  if (check === "error") return <p className="text-sm text-ink-muted">The check couldn&apos;t run right now. Try again.</p>;
  return check.valid ? (
    <p className="flex items-start gap-2 text-sm text-success-text">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Genuine.</strong> These are exactly the numbers that were sealed{check.onchain === true ? ", and the contract on the public chain confirmed it" : ""}.
      </span>
    </p>
  ) : (
    <p className="flex items-start gap-2 text-sm text-critical-text">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Doesn&apos;t match.</strong> {check.reason}
      </span>
    </p>
  );
}

function MonthCard({ m, check, onCheck }: { m: SharedMonth; check: Check | undefined; onCheck: () => void }) {
  const cats = Object.entries(m.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <li className="border border-border bg-canvas-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-2xl">{label(m.period)}</h2>
        <p className="font-heading text-3xl tabular-nums">
          {m.totalKg.toLocaleString("en-IN")} <span className="text-base text-ink-muted">kg CO₂e</span>
        </p>
      </div>
      {cats.length > 0 && (
        <p className="mt-1 text-[13px] text-ink-muted">{cats.map(([c, kg]) => `${c} ${kg.toLocaleString("en-IN")} kg`).join(" · ")}</p>
      )}
      {m.verifiedReductionsKg > 0 && (
        <p className="mt-1 text-[13px] text-success-text">Includes {m.verifiedReductionsKg} kg of cuts verified from bills and fill-ups.</p>
      )}
      {m.anchor && (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-muted">
          Sealed {day(m.anchor.anchoredAt)} on {chainName(m.anchor.chain)}
          {m.anchor.blockNumber ? ` · block ${m.anchor.blockNumber.toLocaleString("en-IN")}` : ""} · receipt {m.anchor.txHash.slice(0, 10)}…
          {m.anchor.explorerUrl && (
            <>
              {" "}
              ·{" "}
              <a href={m.anchor.explorerUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                see it on the public chain ↗
              </a>
            </>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={onCheck} className="inline-flex h-9 items-center gap-2 rounded-md border border-ink px-3 text-sm hover:bg-ink hover:text-canvas">
          <ShieldCheck className="h-4 w-4" /> Check this month
        </button>
        <Verdict check={check} />
      </div>
    </li>
  );
}

export default function VerifySharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicShare | null>(null);
  const [failed, setFailed] = useState(false);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [fileCheck, setFileCheck] = useState<Check | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/public/verify/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => (res.status === 503 || res.status === 429 ? Promise.reject() : setData(await res.json())))
      .catch(() => setFailed(true));
  }, [token]);

  async function check(m: SharedMonth) {
    setChecks((c) => ({ ...c, [m.period]: "checking" }));
    try {
      const out = await engine.verify(m.proof);
      setChecks((c) => ({ ...c, [m.period]: out }));
    } catch {
      setChecks((c) => ({ ...c, [m.period]: "error" }));
    }
  }

  async function checkFile(file: File) {
    setFileCheck("checking");
    try {
      const p = JSON.parse(await file.text());
      setFileCheck(await engine.verify({ statement: p.statement, salt: p.salt, proof: p.proof, batch_id: p.batch_id }));
    } catch {
      setFileCheck({ valid: false, reason: "That file isn't a Carbon Wallet proof file." });
    }
  }

  const months = data?.state === "ok" ? data.months : [];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-5">
          <Link href="/" className="flex items-end gap-1.5">
            <span className="font-heading text-lg font-medium leading-none">Carbon Wallet</span>
            <span className="mb-[2px] h-1.5 w-1.5 bg-secondary" aria-hidden />
          </Link>
          <span className="label-caps text-ink-muted">Sealed record</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-[760px] flex-col gap-8 px-5 py-10">
        {!data && !failed && <div className="h-40 animate-pulse rounded-md bg-canvas-subtle" />}
        {failed && <p className="text-sm text-ink-muted">This record can&apos;t be loaded right now. Try again in a minute.</p>}
        {data && data.state !== "ok" && (
          <section>
            <h1 className="font-heading text-4xl">
              {data.state === "expired" ? "This link has expired" : data.state === "revoked" ? "This link was turned off" : "Link not found"}
            </h1>
            <p className="mt-3 text-ink-muted">Ask the household to share a new link from Carbon Wallet.</p>
          </section>
        )}
        {data?.state === "ok" && (
          <>
            <section>
              <p className="label-caps text-ink-muted">Shared with you by a Carbon Wallet household</p>
              <h1 className="mt-2 font-heading text-4xl leading-tight md:text-5xl">Carbon record {data.carbonId}</h1>
              <p className="mt-2 text-ink-muted">
                {data.city}, {data.region} · {months.length} sealed {months.length === 1 ? "month" : "months"} · link valid until {day(data.expiresAt)}
              </p>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed">
                Each month below was sealed when it was recorded. Press <em>Check</em> to confirm the numbers are exactly the ones that were
                sealed. Nobody, including Carbon Wallet, can change a sealed month without the check failing.
              </p>
              {months.length > 1 && (
                <button onClick={() => months.forEach(check)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm text-canvas">
                  <ShieldCheck className="h-4 w-4" /> Check every month
                </button>
              )}
            </section>

            <ol className="flex flex-col gap-4">
              {months.map((m) => (
                <MonthCard key={m.period} m={m} check={checks[m.period]} onCheck={() => check(m)} />
              ))}
            </ol>
          </>
        )}

        <section className="border-t border-border pt-6">
          <h2 className="font-heading text-xl">Have a proof file?</h2>
          <p className="mt-1 text-sm text-ink-muted">A household can also send you the proof file from its Proof check page. Check it here.</p>
          <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm hover:border-ink">
            <Upload className="h-4 w-4" /> Choose a proof file
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && checkFile(e.target.files[0])} />
          </label>
          <div className="mt-3">
            <Verdict check={fileCheck} />
          </div>
        </section>

        <p className="text-[12px] leading-relaxed text-ink-light">
          What this shows: these totals are exactly what the household&apos;s bills and records added up to when the month was sealed. It
          doesn&apos;t show anything the household didn&apos;t record. No names, addresses, bills or card details are shared.{" "}
          <Link href="/methodology" className="underline">
            How the numbers are worked out
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
