"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useAppStore } from "@/store";
import type { Insights } from "@/server/services/insights.service";

type Narrative = { bullets: string[]; model: string | null; reason: string | null };

/**
 * "In plain words": template sentences from our numbers straight away, swapped for an AI-written version when it
 * arrives. The AI only rewords; any sentence with a number we didn't give it is dropped on the server.
 */
export function PlainSummary({ month, className = "" }: { month: string; className?: string }) {
  const { activeHouseholdId, demoRole } = useAppStore();
  const headers = { "x-demo-role": demoRole };
  const facts = useQuery<Insights>({
    queryKey: ["household", activeHouseholdId, "insights", month, demoRole],
    queryFn: async () => (await fetch(`/api/households/${activeHouseholdId}/insights?month=${month}`, { headers })).json(),
    enabled: !!activeHouseholdId && !!month,
  });
  const ai = useQuery<Narrative>({
    queryKey: ["household", activeHouseholdId, "narrative", month],
    queryFn: async () => (await fetch(`/api/households/${activeHouseholdId}/insights/narrative?month=${month}`, { headers })).json(),
    enabled: !!activeHouseholdId && !!month && !!facts.data?.available,
    staleTime: 10 * 60_000,
  });
  if (!facts.data?.available) return null;
  const useAi = (ai.data?.bullets.length ?? 0) >= 2;
  const bullets = useAi ? ai.data!.bullets : facts.data.bullets;

  return (
    <section className={`border border-ink bg-canvas-card p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 label-caps text-ink">
          <Sparkles className="h-4 w-4 text-secondary" /> In plain words
        </span>

      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
