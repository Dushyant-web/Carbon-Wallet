"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePwa } from "@/components/pwa/PwaProvider";
import type { NotifyPrefs } from "@/server/services/notify.service";

type Status = { configured: boolean; publicKey: string | null; prefs: NotifyPrefs; devices: number };

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const hours = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "am" : "pm"}`;

/** Reminders by notification: turn them on for this device, choose which ones, and quiet hours. */
export function ReminderSettings() {
  const pwa = usePwa();
  const qc = useQueryClient();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery<Status>({
    queryKey: ["me", "push"],
    queryFn: async () => {
      const res = await fetch("/api/me/push");
      if (!res.ok) throw new Error("Couldn't load reminder settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (!pwa.registration || !("PushManager" in window)) {
      setSubscribed(false);
      return;
    }
    pwa.registration.pushManager.getSubscription().then((s) => setSubscribed(!!s)).catch(() => setSubscribed(false));
  }, [pwa.registration]);

  const supported = typeof window !== "undefined" && "Notification" in window && "PushManager" in window;
  const needsInstall = pwa.isIOS && !pwa.installed;

  async function turnOn() {
    if (!pwa.registration || !data?.publicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Notifications are blocked for this site. Allow them in the browser's site settings, then try again.");
        return;
      }
      const sub = await pwa.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) });
      const res = await fetch("/api/me/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't turn reminders on");
      setSubscribed(true);
      qc.invalidateQueries({ queryKey: ["me", "push"] });
      setMsg("Reminders are on for this device.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't turn reminders on");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    const sub = await pwa.registration?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/me/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setSubscribed(false);
    qc.invalidateQueries({ queryKey: ["me", "push"] });
    setMsg("Reminders are off for this device.");
  }

  async function savePrefs(patch: Partial<NotifyPrefs>) {
    const res = await fetch("/api/me/push", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (res.ok) qc.setQueryData<Status>(["me", "push"], (s) => (s ? { ...s, prefs: { ...s.prefs, ...patch } } : s));
  }

  async function test() {
    setMsg(null);
    const res = await fetch("/api/me/push/test", { method: "POST" });
    const out = await res.json().catch(() => ({}));
    setMsg(res.ok ? (out.sent > 0 ? "Sent. It should appear in a few seconds." : "No device received it; turn reminders on first.") : out.error ?? "Couldn't send");
  }

  if (!data) return <div className="h-40 animate-pulse rounded-md bg-canvas-subtle" />;
  const prefs = data.prefs;
  const toggle = (key: "checkin" | "bill" | "goal", text: string) => (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span>{text}</span>
      <input type="checkbox" checked={prefs[key]} onChange={(e) => savePrefs({ [key]: e.target.checked })} className="h-4 w-4 accent-ink" />
    </label>
  );

  return (
    <section className="rounded-md border border-border bg-canvas-card p-5 md:p-6">
      <h2 className="font-heading text-2xl">Reminders</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        A nudge for the weekly check-in on Sunday evening, when your next electricity bill should be out, and when a month is heading
        over your goal. They also show on Home, notifications or not.
      </p>

      {!data.configured ? (
        <p className="mt-4 text-sm text-ink-muted">Notifications aren&apos;t set up on this server yet, so reminders show on Home only.</p>
      ) : needsInstall ? (
        <p className="mt-4 text-sm text-ink-muted">On iPhone, put Carbon Wallet on your home screen first (Share → Add to Home Screen), then turn reminders on from there.</p>
      ) : !supported ? (
        <p className="mt-4 text-sm text-ink-muted">This browser can&apos;t show notifications. Reminders still show on Home.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {subscribed ? (
            <>
              <span className="text-sm text-success-text">On for this device</span>
              <button onClick={test} className="h-9 rounded-md border border-border px-3 text-sm hover:border-ink">
                Send a test
              </button>
              <button onClick={turnOff} className="h-9 rounded-md border border-border px-3 text-sm hover:border-ink">
                Turn off here
              </button>
            </>
          ) : (
            <button onClick={turnOn} disabled={busy || subscribed === null || !pwa.registration} className="h-10 rounded-md bg-ink px-4 text-sm text-canvas disabled:opacity-50">
              {busy ? "Turning on…" : "Turn on reminders for this device"}
            </button>
          )}
          {data.devices > 0 && <span className="font-mono text-[11px] text-ink-muted">{data.devices} device{data.devices === 1 ? "" : "s"} on</span>}
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-ink-muted">{msg}</p>}

      <div className="mt-5 max-w-md divide-y divide-border border-y border-border">
        {toggle("checkin", "Weekly check-in (Sunday evening)")}
        {toggle("bill", "When the next electricity bill should be out")}
        {toggle("goal", "When a month is heading over the goal")}
        <div className="flex items-center justify-between gap-4 py-2 text-sm">
          <span>Quiet hours</span>
          <span className="flex items-center gap-2">
            <select value={prefs.quietFrom} onChange={(e) => savePrefs({ quietFrom: Number(e.target.value) })} className="h-8 rounded border border-border bg-canvas-card px-2">
              {hours.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
            to
            <select value={prefs.quietTo} onChange={(e) => savePrefs({ quietTo: Number(e.target.value) })} className="h-8 rounded border border-border bg-canvas-card px-2">
              {hours.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </span>
        </div>
      </div>
    </section>
  );
}
