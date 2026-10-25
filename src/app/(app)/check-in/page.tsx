"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CheckInAnswers, CheckInState } from "@/server/services/checkin.service";

const field = "h-11 w-full rounded-md border border-border bg-canvas-card px-3 font-mono text-base tabular-nums outline-none focus:border-ink";
const fmtWeek = (iso: string) => {
  const start = new Date(`${iso}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(start)} – ${f(end)}`;
};

export default function CheckInPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const key = ["household", activeHouseholdId, "checkin", demoRole];
  const { data, isLoading } = useQuery<CheckInState>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/checkins`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("Couldn't load the check-in");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });
  const [answers, setAnswers] = useState<CheckInAnswers | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    if (data) setAnswers(data.prefill);
  }, [data]);

  const save = useMutation({
    mutationFn: async (body: CheckInAnswers) => {
      const res = await fetch(`/api/households/${activeHouseholdId}/checkins`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-role": demoRole },
        body: JSON.stringify(body),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Couldn't save this week");
      return out as { filled: number; state: CheckInState };
    },
    onSuccess: (out) => {
      setError(null);
      setEditing(false);
      setFilled(out.filled);
      qc.setQueryData(key, out.state);
      qc.invalidateQueries({ queryKey: ["household", activeHouseholdId] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save this week"),
  });

  if (isLoading || !data || !answers) return <Skeleton className="h-96 w-full" />;
  const canSave = can("checkin:create");
  const setNum = (patch: Partial<CheckInAnswers>) => setAnswers({ ...answers, ...patch });
  const n = (v: string) => Math.max(0, Number(v) || 0);

  const intro = (
    <PageIntro
      section="Your home"
      title="Weekly check-in"
      what={`About a minute, once a week (${fmtWeek(data.weekStart)}).`}
      doThis="Check the numbers. If the week was like the last one, one tap is enough."
      get="Your record stays up to date between bills, and your goal knows where the month is heading."
    />
  );

  if (data.done && !editing) {
    return (
      <div className="flex max-w-2xl flex-col gap-8">
        {intro}
        <section className="rounded-md border border-border bg-canvas-card p-6">
          <p className="label-caps text-success-text">Done for this week</p>
          <p className="mt-2 font-heading text-3xl">
            {data.streak} {data.streak === 1 ? "week" : "weeks"} in a row
          </p>
          {filled > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              You&apos;d missed {filled} {filled === 1 ? "week" : "weeks"}; we filled {filled === 1 ? "it" : "them"} from your usual week and marked{" "}
              {filled === 1 ? "it" : "them"} as estimated.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm text-canvas">
              Back to Home
            </Link>
            {canSave && (
              <button onClick={() => setEditing(true)} className="h-10 rounded-md border border-border px-4 text-sm hover:border-ink">
                Change this week
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {intro}
      {data.missedWeeks > 0 && (
        <p className="rounded-md border border-border bg-canvas-subtle p-3 text-sm text-ink-muted">
          You missed {data.missedWeeks} {data.missedWeeks === 1 ? "week" : "weeks"}. When you save, we&apos;ll fill{" "}
          {data.missedWeeks === 1 ? "it" : "them"} from these answers and mark {data.missedWeeks === 1 ? "it" : "them"} as estimated, never as zero.
        </p>
      )}

      <section className="flex flex-col gap-5">
        {data.vehicles.map((v) => {
          const entry = answers.vehicles.find((x) => x.vehicleId === v.id);
          return (
            <label key={v.id} className="block">
              <span className="label-caps text-ink-muted">
                {v.name} · {v.fuel} · km this week
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={entry?.km ?? 0}
                onChange={(e) =>
                  setNum({ vehicles: [...answers.vehicles.filter((x) => x.vehicleId !== v.id), { vehicleId: v.id, km: n(e.target.value) }] })
                }
                className={`mt-1 ${field}`}
              />
            </label>
          );
        })}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label-caps text-ink-muted">Metro · km</span>
            <input type="number" inputMode="numeric" min={0} value={answers.metroKm} onChange={(e) => setNum({ metroKm: n(e.target.value) })} className={`mt-1 ${field}`} />
          </label>
          <label className="block">
            <span className="label-caps text-ink-muted">Bus · km</span>
            <input type="number" inputMode="numeric" min={0} value={answers.busKm} onChange={(e) => setNum({ busKm: n(e.target.value) })} className={`mt-1 ${field}`} />
          </label>
        </div>
        {data.hasAc && (
          <label className="block">
            <span className="flex items-baseline justify-between">
              <span className="label-caps text-ink-muted">AC · hours a day</span>
              <span className="font-mono text-lg tabular-nums">{answers.acHoursPerDay ?? 0} h</span>
            </span>
            <input
              type="range"
              min={0}
              max={24}
              step={0.5}
              value={answers.acHoursPerDay ?? 0}
              onChange={(e) => setNum({ acHoursPerDay: Number(e.target.value) })}
              className="mt-2 w-full accent-ink"
            />
          </label>
        )}
        <p className="text-xs text-ink-muted">
          Already in an electricity bill or a fuel fill-up? We keep it as a note and never count it twice.
        </p>
      </section>

      {error && <p className="text-sm text-critical">{error}</p>}
      {canSave ? (
        <div className="flex flex-wrap gap-3">
          {data.hasLast && !data.done && (
            <button
              onClick={() => save.mutate(data.prefill)}
              disabled={save.isPending}
              className="h-11 rounded-md border border-ink px-5 text-sm font-medium hover:bg-ink hover:text-canvas"
            >
              Same as last week
            </button>
          )}
          <button onClick={() => save.mutate(answers)} disabled={save.isPending} className="h-11 rounded-md bg-ink px-5 text-sm font-medium text-canvas">
            {save.isPending ? "Saving…" : "Save this week"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">You&apos;re viewing, so you can&apos;t check in for the household.</p>
      )}
    </div>
  );
}
