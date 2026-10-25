"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Car, Check, Flame, Lock, Plug, ShowerHead, Snowflake, Sprout, Timer, TreeDeciduous, Trees, TreePine } from "lucide-react";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ChallengeView, Player } from "@/server/services/challenge.service";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ac_24: Snowflake,
  ac_hour_less: Timer,
  standby_off: Plug,
  geyser_short: ShowerHead,
  car_free_day: Car,
};
const LEVEL_ICONS = [Sprout, Sprout, TreeDeciduous, TreeDeciduous, Trees, TreePine];

function Ring({ pct, children }: { pct: number; children: React.ReactNode }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-canvas-subtle" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="text-secondary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** A short burst of paper confetti; skipped for people who prefer reduced motion (see globals.css). */
function Confetti({ seed }: { seed: number }) {
  const colours = ["#B4532F", "#3F6B4E", "#B7862B", "#2F5D7C", "#C9A227"];
  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center" aria-hidden key={seed}>
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="cw-confetti absolute block h-2.5 w-1.5"
          style={
            {
              backgroundColor: colours[i % colours.length],
              "--dx": `${Math.round((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 * 520)}px`,
              "--rot": `${(i * 47) % 360}deg`,
              animationDelay: `${(i % 7) * 20}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function ChallengesPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const key = ["household", activeHouseholdId, "challenges", demoRole];
  const { data, isLoading } = useQuery<{ challenges: ChallengeView[]; player: Player }>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/challenges`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("Couldn't load challenges");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });

  async function act(template: string, action: "join" | "checkin" | "leave") {
    setBusy(template + action);
    setMessage(null);
    const before = data?.player;
    const res = await fetch(`/api/households/${activeHouseholdId}/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-role": demoRole },
      body: JSON.stringify({ template, action }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(body.error ?? "Something went wrong");
      return;
    }
    qc.setQueryData(key, body);
    if (action === "checkin") {
      setBurst((b) => b + 1);
      const after: Player = body.player;
      const newBadges = after.badges.filter((b) => b.earned && !before?.badges.find((x) => x.id === b.id)?.earned);
      setMessage(
        newBadges.length
          ? `Badge unlocked: ${newBadges.map((b) => b.name).join(", ")}!`
          : after.level > (before?.level ?? 0)
            ? `Level up! You're now a ${after.levelName}.`
            : `+${after.xp - (before?.xp ?? 0)} XP. See you tomorrow!`,
      );
    }
  }

  const canPlay = can("challenge:join");
  const p = data?.player;
  const LevelIcon = p ? LEVEL_ICONS[Math.min(LEVEL_ICONS.length - 1, p.level - 1)] : Sprout;
  const toNext = p && p.nextLevelXp ? ((p.xp - p.levelFloor) / (p.nextLevelXp - p.levelFloor)) * 100 : 100;

  return (
    <div className="flex flex-col gap-10">
      {burst > 0 && <Confetti seed={burst} />}
      <PageIntro
        section="Improve"
        title="Challenges"
        what="Small daily habits that cut real kilos. Each one is sized to your home: your AC, your car, your electricity rate."
        doThis="Join a challenge, do it, and tap “I did it today!” once a day. Miss a day and the streak resets."
        get="Points, levels from Seedling to Rainforest, badges, and a running count of kg and rupees saved."
      />

      {isLoading || !data || !p ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {/* Player card */}
          <section className="grid grid-cols-1 gap-6 bg-primary p-6 text-canvas-card md:grid-cols-[auto_1fr_auto]">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-tertiary">
                <LevelIcon className="h-8 w-8 text-canvas-card" />
              </div>
              <div>
                <span className="label-caps text-canvas-card/60">Level {p.level}</span>
                <p className="font-heading text-3xl leading-tight">{p.levelName}</p>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-mono tabular-nums">{p.xp} XP</span>
                <span className="text-canvas-card/60">
                  {p.nextLevelXp ? `${p.nextLevelXp - p.xp} XP to ${p.nextLevelName}` : "Top level!"}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-canvas-card/15">
                <div className="h-full rounded-full bg-secondary transition-all duration-700" style={{ width: `${toNext}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-canvas-card/60">10 XP a check-in · +5 while on a 3-day streak · +50 for finishing</p>
            </div>
            <dl className="grid grid-cols-2 gap-6 md:text-right">
              <div>
                <dt className="label-caps text-canvas-card/60">Saved</dt>
                <dd className="font-heading text-2xl tabular-nums">{p.totalKg} kg</dd>
              </div>
              <div>
                <dt className="label-caps text-canvas-card/60">Rupees</dt>
                <dd className="font-heading text-2xl tabular-nums">₹{p.totalInr.toLocaleString("en-IN")}</dd>
              </div>
            </dl>
          </section>

          {message && (
            <p role="status" className="border border-success-border bg-success-subtle px-4 py-2.5 text-sm text-success-text">
              {message}
            </p>
          )}

          {/* Badges */}
          <section>
            <span className="label-caps">Badges · {p.badges.filter((b) => b.earned).length} of {p.badges.length}</span>
            <div className="mt-3 flex flex-wrap gap-3">
              {p.badges.map((b) => (
                <div
                  key={b.id}
                  title={b.desc}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                    b.earned ? "border-warning bg-warning-subtle text-warning-text" : "border-border text-ink-light"
                  }`}
                >
                  {b.earned ? <Award className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                  <span className="font-medium">{b.name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Challenge cards */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.challenges.map((c) => {
              const Icon = ICONS[c.template] ?? Award;
              return (
                <article
                  key={c.template}
                  className={`flex flex-col gap-4 border p-5 transition-colors ${
                    c.status === "COMPLETED" ? "border-success-border bg-success-subtle/50" : c.status === "ACTIVE" ? "border-ink bg-canvas-card" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Ring pct={c.progress}>
                      <span className="font-heading text-xl leading-none tabular-nums">{c.daysDone}</span>
                      <span className="text-[10px] text-ink-muted">of {c.targetDays}</span>
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="flex items-center gap-2 font-heading text-xl font-medium">
                          <Icon className="h-5 w-5 shrink-0 text-secondary" /> {c.title}
                        </h3>
                        {c.streak > 0 && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-semibold text-warning-text">
                            <Flame className="h-3.5 w-3.5" /> {c.streak}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">{c.blurb}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
                    <span>
                      Saves <strong className="tabular-nums">{c.kgPerDay} kg</strong> and{" "}
                      <strong className="tabular-nums">₹{c.inrPerDay}</strong> a day
                    </span>
                    {c.daysDone > 0 && <span className="text-success-text">So far: {c.kgSaved} kg · ₹{c.inrSaved}</span>}
                  </div>
                  <p className="-mt-2 font-mono text-[10px] text-ink-light">{c.math}</p>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    {c.status === "AVAILABLE" ? (
                      <button
                        disabled={!canPlay || !!busy}
                        onClick={() => act(c.template, "join")}
                        className="h-10 rounded-md border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-canvas-card disabled:opacity-40"
                      >
                        Join challenge
                      </button>
                    ) : c.status === "COMPLETED" ? (
                      <span className="flex items-center gap-2 text-sm font-semibold text-success-text">
                        <Award className="h-5 w-5" /> Completed! +50 XP
                      </span>
                    ) : c.checkedInToday ? (
                      <span className="flex items-center gap-2 text-sm text-success-text">
                        <Check className="h-5 w-5" /> Done for today
                      </span>
                    ) : (
                      <button
                        disabled={!canPlay || !!busy}
                        onClick={() => act(c.template, "checkin")}
                        className="h-11 rounded-md bg-secondary px-5 text-sm font-semibold text-white shadow-tier-1 transition-transform hover:bg-secondary-hover active:scale-95 disabled:opacity-40"
                      >
                        I did it today!
                      </button>
                    )}
                    {c.status !== "AVAILABLE" && canPlay && (
                      <button onClick={() => act(c.template, "leave")} className="text-xs text-ink-light hover:text-critical-text">
                        {c.status === "COMPLETED" ? "Start over" : "Leave"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
          <p className="text-[12px] text-ink-muted">
            Savings are estimates from your own appliances, car and bills. They show up for real in your next electricity bill.
          </p>
        </>
      )}
    </div>
  );
}
