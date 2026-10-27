"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SELLS } from "@/lib/merchant";

type Mode = "login" | "signup" | "admin-login" | "admin-signup" | "merchant-login" | "merchant-signup";

const COPY: Record<Mode, { eyebrow: string; title: string; cta: string; endpoint: string }> = {
  login: { eyebrow: "Log in", title: "Welcome back", cta: "Log in", endpoint: "/api/auth/login" },
  signup: { eyebrow: "Create account", title: "Start your carbon statement", cta: "Create account", endpoint: "/api/auth/signup" },
  "admin-login": { eyebrow: "Admin", title: "Admin log in", cta: "Log in as admin", endpoint: "/api/auth/login" },
  "admin-signup": { eyebrow: "Admin", title: "Create an admin account", cta: "Create admin account", endpoint: "/api/auth/admin/signup" },
  "merchant-login": { eyebrow: "Shops", title: "Shop log in", cta: "Log in to the counter", endpoint: "/api/auth/login" },
  "merchant-signup": { eyebrow: "Shops", title: "Register your shop", cta: "Register shop", endpoint: "/api/auth/merchant/signup" },
};

const DEMO = {
  user: { email: "arjun.sharma@example.com", password: "CarbonDemo#2026" },
  admin: { email: "admin@carbonwallet.in", password: "AdminDemo#2026" },
  merchant: { email: "counter@demo-appliances.example.com", password: "ShopDemo#2026" },
};

const inputCls =
  "h-10 w-full rounded-sm border border-border bg-canvas-card px-3 text-sm text-ink focus:border-ink focus:outline-none";

const GOOGLE_ERRORS: Record<string, string> = {
  "google-off": "Google sign-in isn't set up on this server yet.",
  "google-cancelled": "Google sign-in was cancelled.",
  "google-state": "That sign-in link expired. Try again.",
  "slow-down": "Too many attempts. Wait a minute and try again.",
  google: "Google sign-in didn't work. Try again.",
};

function GoogleButton({ as, label }: { as: "household" | "merchant"; label: string }) {
  const href = `/api/auth/google/start?as=${as}`;
  return (
    <a
      href={href}
      onClick={(e) => {
        // carry ?next= through Google and back
        const next = new URLSearchParams(window.location.search).get("next");
        if (next) {
          e.preventDefault();
          window.location.href = `${href}&next=${encodeURIComponent(next)}`;
        }
      }}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-ink bg-canvas-card text-[15px] font-semibold text-ink hover:bg-canvas-subtle"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  );
}

export function AuthForm({ mode, google = false }: { mode: Mode; google?: boolean }) {
  const copy = COPY[mode];
  const isSignup = mode === "signup" || mode === "admin-signup" || mode === "merchant-signup";
  const isAdmin = mode.startsWith("admin");
  const isMerchant = mode.startsWith("merchant");
  const demo = isAdmin ? DEMO.admin : isMerchant ? DEMO.merchant : DEMO.user;
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
    agree: false,
    businessName: "",
    gstin: "",
    city: "",
    state: "",
    sells: "APPLIANCES",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // errors handed back by the Google callback (?error=…&message=…)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("error");
    if (code && GOOGLE_ERRORS[code]) setError(q.get("message") || GOOGLE_ERRORS[code]);
  }, []);
  const offerGoogle = google && !isAdmin;
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
    if (mode === "merchant-login" && body.user?.platformRole !== "MERCHANT") {
      await fetch("/api/auth/logout", { method: "POST" });
      setBusy(false);
      setError("This isn't a shop account. Use the regular log in.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    const home =
      body.user?.platformRole === "ADMIN" && isAdmin ? "/admin" : body.user?.platformRole === "MERCHANT" ? "/merchant" : "/dashboard";
    window.location.href = safeNext ?? home;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="w-full max-w-sm">
      <span className="label-caps">{copy.eyebrow}</span>
      <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight">{copy.title}</h1>

      {offerGoogle && (
        <div className="mt-8 flex flex-col gap-3">
          <GoogleButton as={isMerchant ? "merchant" : "household"} label={isSignup ? "Sign up with Google" : "Continue with Google"} />
          <p className="text-center text-[12px] text-ink-muted">No password or OTP needed. We only get your name and email.</p>
          <div className="flex items-center gap-3 text-[12px] text-ink-muted">
            <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form onSubmit={submit} className={`${offerGoogle ? "mt-4" : "mt-8"} flex flex-col gap-4`}>
        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">{isMerchant ? "Your name" : "Full name"}</span>
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
        {mode === "merchant-signup" && (
          <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
            <legend className="label-caps pr-2">The shop</legend>
            <label className="flex flex-col gap-1.5">
              <span className="label-caps">Shop name</span>
              <input className={inputCls} value={form.businessName} onChange={set("businessName")} autoComplete="organization" required minLength={2} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-caps">GSTIN (optional)</span>
              <input className={`${inputCls} font-mono uppercase`} value={form.gstin} onChange={set("gstin")} maxLength={15} autoComplete="off" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="label-caps">City</span>
                <input className={inputCls} value={form.city} onChange={set("city")} autoComplete="address-level2" required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label-caps">State</span>
                <input className={inputCls} value={form.state} onChange={set("state")} autoComplete="address-level1" required />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="label-caps">You sell</span>
              <select className={inputCls} value={form.sells} onChange={set("sells")}>
                {SELLS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-ink-muted">
                Carbon Wallet checks every shop before it can scan customers&apos; cards. You&apos;ll see the counter once you&apos;re approved.
              </span>
            </label>
          </fieldset>
        )}
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
          onClick={() => setForm((f) => ({ ...f, ...demo }))}
          className="mt-4 w-full border border-dashed border-border-hover px-3 py-2 text-left text-xs text-ink-muted hover:border-ink hover:text-ink"
        >
          Fill demo {isAdmin ? "admin" : isMerchant ? "shop" : "account"}: <span className="font-mono">{demo.email}</span>
        </button>
      )}

      <div className="mt-8 flex flex-col gap-2 border-t border-border pt-4 text-sm text-ink-muted">
        {mode === "login" && (
          <>
            <span>New here? <Link className="text-ink underline" href="/signup">Create an account</Link></span>
            <span>Running the platform? <Link className="text-ink underline" href="/admin/login">Admin log in</Link></span>
            <span>Selling appliances or vehicles? <Link className="text-ink underline" href="/merchant/login">Shop log in</Link></span>
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
        {mode === "merchant-login" && (
          <>
            <span>New shop? <Link className="text-ink underline" href="/merchant/signup">Register your shop</Link></span>
            <span>Not a shop? <Link className="text-ink underline" href="/login">Regular log in</Link></span>
          </>
        )}
        {mode === "merchant-signup" && (
          <span>Already registered? <Link className="text-ink underline" href="/merchant/login">Shop log in</Link></span>
        )}
      </div>
    </div>
  );
}
