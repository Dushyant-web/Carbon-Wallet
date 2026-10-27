"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { SELLS } from "@/lib/merchant";

const inputCls = "h-11 w-full rounded-sm border border-border bg-canvas-card px-3 text-sm text-ink focus:border-ink focus:outline-none";

/** After "Sign up with Google" as a shop: the shop's details, then the admin approves it. */
export function ShopDetailsForm({ name }: { name: string }) {
  const [f, setF] = useState({ businessName: "", gstin: "", city: "", state: "", sells: "APPLIANCES" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/merchant/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? "Couldn't save the shop.");
    window.location.href = "/merchant";
  }

  return (
    <div className="w-full max-w-sm">
      <span className="label-caps">Shop · step 2 of 2</span>
      <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight">Tell us about the shop</h1>
      <p className="mt-2 text-sm text-ink-muted">Signed in as {name}. Carbon Wallet checks every shop before it can scan customers&apos; cards.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Shop name</span>
          <input className={inputCls} value={f.businessName} onChange={set("businessName")} required minLength={2} autoComplete="organization" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">GSTIN (optional)</span>
          <input className={`${inputCls} font-mono uppercase`} value={f.gstin} onChange={set("gstin")} maxLength={15} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">City</span>
            <input className={inputCls} value={f.city} onChange={set("city")} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">State</span>
            <input className={inputCls} value={f.state} onChange={set("state")} required />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">You sell</span>
          <select className={inputCls} value={f.sells} onChange={set("sells")}>
            {SELLS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : "Send for approval"}</Button>
      </form>
    </div>
  );
}
