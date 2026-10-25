"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";

type Plan = { eraseAfterDays: number; households: { householdId: string; name: string; role: string; otherMembers: number; outcome: "deleted" | "you_leave" | "choose" }[] };
type Consent = { current: string; agreed: boolean; agreedAt: string | null };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** Download everything, delete the household, or delete the account (DPDP Act rights, one tap each). */
export function PrivacySettings() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { can } = usePermissions();
  const [files, setFiles] = useState(false);
  const [open, setOpen] = useState<"account" | "household" | null>(null);
  const [password, setPassword] = useState("");
  const [alsoDelete, setAlsoDelete] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const consent = useQuery<Consent>({ queryKey: ["me", "consent"], queryFn: () => fetch("/api/me/consent").then((r) => r.json()) });
  const plan = useQuery<Plan>({ queryKey: ["me", "delete-plan"], queryFn: () => fetch("/api/me/delete").then((r) => r.json()), enabled: open === "account" });

  async function confirm() {
    setBusy(true);
    setError(null);
    const res =
      open === "account"
        ? await fetch("/api/me/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, deleteHouseholds: alsoDelete }) })
        : await fetch(`/api/households/${activeHouseholdId}/delete`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-demo-role": demoRole },
            body: JSON.stringify({ password }),
          });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(out.error ?? "Couldn't do that. Try again.");
      return;
    }
    // the account is signed out; a deleted household is gone: start again from the front page or Home
    window.location.href = open === "account" ? `/?deleted=${encodeURIComponent(out.eraseOn)}` : "/dashboard";
  }

  return (
    <section className="rounded-md border border-border bg-canvas-card p-5 md:p-6">
      <h2 className="font-heading text-2xl">Privacy &amp; your data</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        {consent.data?.agreed
          ? `You agreed to the privacy notice (${consent.data.current}) on ${day(consent.data.agreedAt!)}.`
          : "You haven't agreed to the current privacy notice yet."}{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Read it
        </Link>
        .
      </p>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="font-heading text-lg">Download your data</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Everything about you and your households in one file, including the proofs of your sealed months, which you can check
          anywhere even without us.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <a href={`/api/me/export${files ? "?files=1" : ""}`} className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm text-canvas">
            Download my data
          </a>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} className="h-4 w-4 accent-ink" />
            Include original bill files I kept
          </label>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="font-heading text-lg">Delete</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Takes effect at once and can&apos;t be undone: everything is erased 30 days later, including the secret codes behind sealed
          months (their public fingerprints can then never be linked to you).
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {can("household:archive") && (
            <button onClick={() => (setOpen("household"), setError(null), setPassword(""))} className="h-10 rounded-md border border-border px-4 text-sm hover:border-critical hover:text-critical">
              Delete this household
            </button>
          )}
          <button onClick={() => (setOpen("account"), setError(null), setPassword(""))} className="h-10 rounded-md border border-critical px-4 text-sm text-critical hover:bg-critical-subtle">
            Delete my account
          </button>
        </div>

        {open && (
          <div className="mt-4 rounded-md border border-critical-border bg-critical-subtle/40 p-4">
            {open === "account" && plan.data && (
              <ul className="mb-4 flex flex-col gap-2 text-sm">
                {plan.data.households.map((h) => (
                  <li key={h.householdId}>
                    <strong>{h.name}</strong>:{" "}
                    {h.outcome === "deleted"
                      ? "deleted with your account (nobody else is in it)."
                      : h.outcome === "you_leave"
                        ? `you leave; it carries on for its other ${h.otherMembers === 1 ? "member" : "members"}.`
                        : (
                          <label className="inline-flex items-center gap-2">
                            you&apos;re its only owner, with {h.otherMembers} other {h.otherMembers === 1 ? "member" : "members"}. Make one of them an owner first, or
                            <input
                              type="checkbox"
                              checked={alsoDelete.includes(h.householdId)}
                              onChange={(e) => setAlsoDelete(e.target.checked ? [...alsoDelete, h.householdId] : alsoDelete.filter((x) => x !== h.householdId))}
                              className="h-4 w-4 accent-critical"
                            />
                            delete it for everyone.
                          </label>
                        )}
                  </li>
                ))}
              </ul>
            )}
            {open === "household" && <p className="mb-4 text-sm">This household and its whole record are hidden from every member now and erased in 30 days.</p>}
            <label className="flex flex-col gap-1 text-sm">
              <span className="label-caps text-ink-muted">Your password, to confirm</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-10 w-72 max-w-full rounded-md border border-border bg-canvas-card px-3" />
            </label>
            {error && <p className="mt-2 text-sm text-critical-text">{error}</p>}
            <div className="mt-3 flex gap-3">
              <button onClick={confirm} disabled={!password || busy} className="h-10 rounded-md bg-critical px-4 text-sm text-white disabled:opacity-50">
                {busy ? "Deleting…" : open === "account" ? "Delete my account" : "Delete this household"}
              </button>
              <button onClick={() => setOpen(null)} className="h-10 rounded-md border border-border px-4 text-sm hover:border-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
