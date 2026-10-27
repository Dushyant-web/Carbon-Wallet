"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lock, ShieldCheck, Stamp, XCircle } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EngineOffline } from "@/components/states/EngineOffline";
import { ShareLinks } from "@/components/proof/ShareLinks";
import { engine, EngineOfflineError, type AnchorResult, type StatementBundle, type StatementStatus, type VerifyResult } from "@/lib/engine";

/** Calls this app's own server (which holds the engine key); a 503 means the proof service is down. */
async function api<T>(path: string, demoRole: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", "x-demo-role": demoRole, ...(init?.headers ?? {}) } });
  const out = await res.json().catch(() => ({}));
  if (res.status === 503) throw new EngineOfflineError();
  if (!res.ok) throw new Error(out.error ?? "Request failed");
  return out as T;
}

const chainLabel = (chain: string) => (chain === "local-devnet" ? "a local test record (not a public chain)" : chain.replace(/-/g, " "));

const short = (hex: string, n = 6) => (hex.length > 2 * n + 2 ? `${hex.slice(0, n + 2)}…${hex.slice(-n)}` : hex);

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className={`border-t-2 pt-4 ${done ? "border-success" : "border-ink"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-success text-white" : "bg-ink text-canvas-card"}`}>
          {done ? "✓" : n}
        </span>
        <h2 className="font-heading text-2xl font-medium">{title}</h2>
      </div>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

export default function ProofPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data } = useHouseholdOverview(activeHouseholdId);
  const { can } = usePermissions();
  const canSeal = can("household:update");
  const base = `/api/households/${activeHouseholdId}/statements`;
  const [bundle, setBundle] = useState<StatementBundle | null>(null);
  const [anchor, setAnchor] = useState<AnchorResult | null>(null);
  const [result, setResult] = useState<(VerifyResult & { tampered?: boolean }) | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = useQuery({
    queryKey: ["household", activeHouseholdId, "statements"],
    queryFn: async () => (await api<{ statements: StatementStatus[] }>(base, demoRole)).statements,
    enabled: !!activeHouseholdId,
    retry: false,
  });

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      const out = await fn();
      setOffline(false);
      return out;
    } catch (e) {
      if (e instanceof EngineOfflineError) setOffline(true);
      else setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Skeleton className="h-96 w-full" />;
  const period = data.period;

  async function lock() {
    // the server reads this month's numbers from your records; nothing typed here can change them
    const out = await run(() => api<StatementBundle>(base, demoRole, { method: "POST", body: JSON.stringify({ month: period.month }) }));
    if (out) {
      setBundle(out);
      setAnchor(null);
      setResult(null);
    }
  }

  async function seal() {
    const out = await run(() => api<AnchorResult>(`${base}/seal`, demoRole, { method: "POST" }));
    if (out && bundle) {
      setAnchor(out);
      const fresh = await run(() => api<StatementBundle>(`${base}/${bundle.id}`, demoRole));
      if (fresh) setBundle(fresh);
      locked.refetch();
    }
  }

  // reopen a month locked earlier, to check it again or download its proof
  async function open(statementId: string) {
    const out = await run(() => api<StatementBundle>(`${base}/${statementId}`, demoRole));
    if (out) {
      setBundle(out);
      setAnchor(null);
      setResult(null);
    }
  }

  async function check(tamper: boolean) {
    if (!bundle || bundle.batch_id == null) return;
    const statement = tamper
      ? { ...bundle.statement, total_kg: Math.round((Number(bundle.statement.total_kg) + 25) * 10) / 10 }
      : bundle.statement;
    const out = await run(() => engine.verify({ statement, salt: bundle.salt, proof: bundle.proof, batch_id: bundle.batch_id! }));
    if (out) setResult({ ...out, tampered: tamper });
  }

  const sealed = !!bundle?.batch_id;

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        section="Your Carbon ID"
        title="Proof check"
        what="Lock a month's numbers so nobody, not even us, can change them later, and let anyone check they're genuine. Useful when a bank, society or judge asks “how do I know this is real?”"
        doThis={`Three buttons, in order: lock ${period.label}, seal it, then check it. Try the “cheat” button to see a fake get caught.`}
        get="A seal on your passbook page and a code anyone can check, without seeing your name or address."
      />

      {offline && <EngineOffline />}
      {error && <p className="text-[13px] text-critical-text">{error}</p>}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <Step n={1} title={`Lock ${period.label}`} done={!!bundle}>
          <p>
            We turn this month&apos;s totals into a <strong className="text-ink">fingerprint</strong>: a short code calculated from the
            numbers. Change even one digit and the fingerprint comes out completely different.
          </p>
          {bundle ? (
            <div className="border border-border bg-canvas-card p-3 font-mono text-xs text-ink">
              <p>{period.label}: {String(bundle.statement.total_kg)} kg CO₂e</p>
              <p className="mt-1 text-ink-muted">fingerprint {short(bundle.leaf)}</p>
            </div>
          ) : (
            <Button disabled={busy || !period.hasData || !canSeal} onClick={lock} icon={<Lock className="h-4 w-4" />}>
              Lock {period.label}
            </Button>
          )}
        </Step>

        <Step n={2} title="Seal it publicly" done={sealed}>
          <p>
            Fingerprints from many homes are combined into one code and written to a public record that nobody can edit.
            Only that combined code is public, so your details stay private.
          </p>
          {sealed && bundle?.anchor ? (
            <div className="border border-border bg-canvas-card p-3 font-mono text-xs text-ink">
              <p>
                Sealed on {chainLabel(bundle.anchor.chain)}
                {anchor ? `, together with ${anchor.n_statements} home${anchor.n_statements === 1 ? "" : "s"}' months` : ""}
              </p>
              <p className="mt-1 text-ink-muted">
                receipt no. {short(bundle.anchor.tx_hash)}
                {bundle.anchor.block_number ? ` · block ${bundle.anchor.block_number.toLocaleString("en-IN")}` : ""}
              </p>
              {bundle.anchor.explorer_url && (
                <a href={bundle.anchor.explorer_url} target="_blank" rel="noreferrer" className="mt-1 inline-block underline underline-offset-2">
                  See it on the public chain ↗
                </a>
              )}
            </div>
          ) : (
            <Button disabled={busy || !bundle || !canSeal} onClick={seal} icon={<Stamp className="h-4 w-4" />} variant={bundle ? "primary" : "secondary"}>
              Seal it
            </Button>
          )}
          {!canSeal && <p className="text-[12px]">Only the household owner or an admin can lock and seal months.</p>}
        </Step>

        <Step n={3} title="Check it" done={!!result?.valid && !result.tampered}>
          <p>Anyone can recompute the fingerprint and match it to the sealed code. No account needed.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !sealed} onClick={() => check(false)} icon={<ShieldCheck className="h-4 w-4" />}>
              Check the real one
            </Button>
            <Button disabled={busy || !sealed} variant="secondary" onClick={() => check(true)}>
              Try to cheat: add 25 kg
            </Button>
          </div>
          {result &&
            (result.valid ? (
              <div className="flex items-start gap-2 border border-success-border bg-success-subtle p-3 text-success-text">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <strong>Genuine.</strong> These are exactly the numbers that were sealed.
                  {result.onchain === true && " The contract on the public chain confirmed it too."}
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 border border-critical-border bg-critical-subtle p-3 text-critical-text">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <strong>Doesn&apos;t match.</strong> {result.tampered ? "Someone changed the numbers after sealing, and it was caught." : result.reason}
                </span>
              </div>
            ))}
        </Step>
      </div>

      <section>
        <span className="label-caps">Your locked months</span>
        {locked.isError ? (
          <p className="mt-2 text-sm text-ink-muted">Can&apos;t reach the proof service right now.</p>
        ) : (locked.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">None yet. Lock and seal your first month above.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {locked.data!.map((s) => (
              <li key={s.period}>
                <button
                  onClick={() => open(s.statement_id)}
                  title="Open to check or download"
                  className={`rounded-full border px-3 py-1 text-xs hover:border-ink ${s.anchored ? "border-success-border bg-success-subtle text-success-text" : "border-border text-ink-muted"}`}
                >
                  {s.period} · {s.anchored ? "sealed" : "locked, not sealed yet"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canSeal && <ShareLinks householdId={activeHouseholdId} demoRole={demoRole} sealed={locked.data ?? []} />}

      {bundle && sealed && (
        <button
          className="self-start text-[12px] text-ink-muted underline underline-offset-2 hover:text-ink"
          onClick={() => {
            const file = new Blob([JSON.stringify({ statement: bundle.statement, salt: bundle.salt, proof: bundle.proof, batch_id: bundle.batch_id, anchor: bundle.anchor }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(file);
            a.download = `carbon-proof-${period.month}.json`;
            a.click();
          }}
        >
          Download the proof file (for a bank or auditor)
        </button>
      )}
    </div>
  );
}
