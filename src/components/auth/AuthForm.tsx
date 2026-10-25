"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Mode = "login" | "signup" | "admin-login" | "admin-signup";

const COPY: Record<Mode, { eyebrow: string; title: string; cta: string; endpoint: string }> = {
  login: { eyebrow: "Log in", title: "Welcome back", cta: "Log in", endpoint: "/api/auth/login" },
  signup: { eyebrow: "Create account", title: "Start your carbon statement", cta: "Create account", endpoint: "/api/auth/signup" },
  "admin-login": { eyebrow: "Admin", title: "Admin log in", cta: "Log in as admin", endpoint: "/api/auth/login" },
  "admin-signup": { eyebrow: "Admin", title: "Create an admin account", cta: "Create admin account", endpoint: "/api/auth/admin/signup" },
};

const DEMO = {
  user: { email: "arjun.sharma@example.com", password: "CarbonDemo#2026" },
  admin: { email: "admin@carbonwallet.in", password: "AdminDemo#2026" },
};

const inputCls =
  "h-10 w-full rounded-sm border border-border bg-canvas-card px-3 text-sm text-ink focus:border-ink focus:outline-none";

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const isSignup = mode === "signup" || mode === "admin-signup";
  const isAdmin = mode.startsWith("admin");
  const [form, setForm] = useState({ name: "", email: "", password: "", inviteCode: "", agree: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO === "1" && !isSignup;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(copy.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Something went wrong. Try again.");
      return;
    }
    if (mode === "admin-login" && body.user?.platformRole !== "ADMIN") {
      await fetch("/api/auth/logout", { method: "POST" });
      setBusy(false);
      setError("This account isn't an admin. Use the regular log in.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    window.location.href = safeNext ?? (body.user?.platformRole === "ADMIN" && isAdmin ? "/admin" : "/dashboard");
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="w-full max-w-sm">
      <span className="label-caps">{copy.eyebrow}</span>
      <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight">{copy.title}</h1>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Full name</span>
            <input className={inputCls} value={form.name} onChange={set("name")} autoComplete="name" required minLength={2} />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Email</span>
          <input className={inputCls} type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Password</span>
          <input
            className={inputCls}
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : 1}
          />
          {isSignup && <span className="text-[11px] text-ink-muted">8+ characters, with letters and a number.</span>}
        </label>
        {mode === "admin-signup" && (
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Admin invite code</span>
            <input className={inputCls} value={form.inviteCode} onChange={set("inviteCode")} autoComplete="off" required />
            <span className="text-[11px] text-ink-muted">Issued by an existing admin. Without it, admin sign-up is refused.</span>
          </label>
        )}

        {isSignup && (
          <label className="flex items-start gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              required
              checked={form.agree}
              onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-ink"
            />
            <span>
              I agree to the{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                privacy notice
              </a>
              : what we keep, why, and how to download or delete it.
            </span>
          </label>
        )}

        {error && <p className="border-l-2 border-critical bg-critical-subtle px-3 py-2 text-xs text-critical-text">{error}</p>}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Please wait…" : copy.cta}
        </Button>
      </form>

      {showDemo && (
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, ...(isAdmin ? DEMO.admin : DEMO.user) }))}
          className="mt-4 w-full border border-dashed border-border-hover px-3 py-2 text-left text-xs text-ink-muted hover:border-ink hover:text-ink"
        >
          Fill demo {isAdmin ? "admin" : "account"}: <span className="font-mono">{(isAdmin ? DEMO.admin : DEMO.user).email}</span>
        </button>
      )}

      <div className="mt-8 flex flex-col gap-2 border-t border-border pt-4 text-sm text-ink-muted">
        {mode === "login" && (
          <>
            <span>New here? <Link className="text-ink underline" href="/signup">Create an account</Link></span>
            <span>Running the platform? <Link className="text-ink underline" href="/admin/login">Admin log in</Link></span>
          </>
        )}
        {mode === "signup" && (
          <span>Already have an account? <Link className="text-ink underline" href="/login">Log in</Link></span>
        )}
        {mode === "admin-login" && (
          <>
            <span>Have an invite code? <Link className="text-ink underline" href="/admin/signup">Create admin account</Link></span>
            <span>Not an admin? <Link className="text-ink underline" href="/login">Regular log in</Link></span>
          </>
        )}
        {mode === "admin-signup" && (
          <span>Already an admin? <Link className="text-ink underline" href="/admin/login">Admin log in</Link></span>
        )}
      </div>
    </div>
  );
}
