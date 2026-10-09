"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { Target, CheckCircle2, Award, Zap, TrendingDown, Flame, Check } from "lucide-react";

interface ChallengeItem {
  id: string;
  template: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  targetDays: number;
  currentDays: number;
  kgSaved: number;
  inrSaved: number;
  streak: number;
  status: string;
}

export default function ActionsPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data, isLoading } = useHouseholdOverview(activeHouseholdId);
  const { can } = usePermissions();
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canApply = can("recommendation:apply");

  // Fetch challenges for active household
  useEffect(() => {
    async function loadChallenges() {
      try {
        setLoadingChallenges(true);
        const res = await fetch(`/api/households/${activeHouseholdId}/challenges`, {
          headers: { "x-demo-role": demoRole },
        });
        if (res.ok) {
          const json = await res.json();
          setChallenges(json.challenges || []);
        }
      } catch (e) {
        console.error("Failed to load challenges:", e);
      } finally {
        setLoadingChallenges(false);
      }
    }
    loadChallenges();
  }, [activeHouseholdId, demoRole]);

  const handleCheckIn = async (challengeId: string) => {
    if (!canApply) return;
    try {
      setUpdatingId(challengeId);
      const res = await fetch(`/api/households/${activeHouseholdId}/challenges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": demoRole,
        },
        body: JSON.stringify({ challengeId, incrementDays: 1 }),
      });
      if (res.ok) {
        const json = await res.json();
        setChallenges((prev) =>
          prev.map((c) => (c.id === challengeId ? json.challenge : c))
        );
      }
    } catch (e) {
      console.error("Failed to update challenge:", e);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Decarbonization Roadmap Unavailable"
        message="Could not load actionable decarbonization pathways for this household."
      />
    );
  }

  const { household, nextBestAction } = data;

  const recommendations = [
    nextBestAction,
    {
      action: "Switch Daytime Inverter Setting to Eco-Mode",
      description: "Operate compressor at 75% peak modulation during noon grid stress windows.",
      category: "Electricity",
      kgSaved: 18.0,
      inrSaved: 520,
      difficulty: "EASY",
    },
    {
      action: "Transit Commute Shift: 2 Days Metro Pass",
      description: "Substitute private combustion commute with urban electrified metro network.",
      category: "Transport",
      kgSaved: 28.5,
      inrSaved: 1100,
      difficulty: "MEDIUM",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-secondary" />
          <h1 className="font-heading text-2xl font-bold text-ink">
            Targeted Actions & Climate Challenges
          </h1>
        </div>
        <p className="text-xs text-ink-muted">
          Prioritized algorithmic decarbonization roadmap for {household.name}
        </p>
      </div>

      {/* Challenges Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold text-ink flex items-center gap-2">
            <Award className="h-4 w-4 text-secondary" />
            Active Household Challenges
          </h2>
          <span className="text-xs text-ink-muted">
            Continuous habits verified against ledger telemetry
          </span>
        </div>

        {loadingChallenges ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : challenges.length === 0 ? (
          <EmptyState
            icon={<Award className="h-6 w-6 text-slate-400" />}
            title="No Active Climate Challenges"
            description="All seasonal challenges are completed or paused for this household cycle."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((c) => {
              const isComplete = c.progress >= 100;
              return (
                <Card
                  key={c.id}
                  className="flex flex-col justify-between p-5 border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-tertiary shrink-0">
                          {c.category === "Electricity" ? (
                            <Zap className="h-5 w-5" />
                          ) : (
                            <Award className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-heading text-sm font-bold text-ink">
                            {c.title}
                          </h3>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            {c.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                        <Flame className="h-3 w-3 fill-amber-500 text-amber-500" />
                        <span>{c.streak} Day Streak</span>
                      </div>
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed">
                      {c.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-ink">
                          {c.currentDays} of {c.targetDays} days completed
                        </span>
                        <span className="font-bold text-primary tabular-nums">
                          {c.progress}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-secondary transition-all duration-500"
                          style={{ width: `${c.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Impact stats */}
                    <div className="flex items-center gap-4 text-[11px] font-medium text-ink-muted pt-1">
                      <span className="text-emerald-700 font-semibold tabular-nums">
                        🌱 -{c.kgSaved} kg saved
                      </span>
                      <span className="tabular-nums">
                        💰 ₹{c.inrSaved} saved
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-3 flex items-center justify-between">
                    <span className="text-[10px] text-ink-muted">
                      {isComplete ? "Goal Reached!" : `${c.targetDays - c.currentDays} days to milestone`}
                    </span>
                    <Button
                      variant={isComplete ? "secondary" : "primary"}
                      size="sm"
                      disabled={isComplete || !canApply || updatingId === c.id}
                      onClick={() => handleCheckIn(c.id)}
                      icon={isComplete ? <Check className="h-3.5 w-3.5" /> : undefined}
                    >
                      {isComplete
                        ? "Completed"
                        : updatingId === c.id
                        ? "Saving..."
                        : canApply
                        ? "Check In (+1 Day)"
                        : "View Only"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommended Actions List */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-border bg-canvas-subtle p-4">
          <h3 className="font-heading text-sm font-bold text-ink">
            Ranked Recommendations
          </h3>
          <p className="text-xs text-ink-muted">
            Ranked by impact × relevance ÷ (cost × difficulty)
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {recommendations.map((rec, idx) => {
            const isApplied = appliedIds.includes(rec.action);
            return (
              <div
                key={idx}
                className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-col gap-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-primary border border-border">
                      {rec.category}
                    </span>
                    <span className="text-[11px] text-ink-muted font-medium">
                      {rec.difficulty} Difficulty
                    </span>
                  </div>
                  <h4 className="font-heading text-sm font-bold text-ink">
                    {rec.action}
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {rec.description}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1 text-emerald-700 tabular-nums">
                      <TrendingDown className="h-3.5 w-3.5" />
                      <span>-{rec.kgSaved} kg CO₂e / mo</span>
                    </div>
                    <div className="text-ink-muted tabular-nums">
                      ₹{rec.inrSaved} monthly bill reduction
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    variant={isApplied ? "secondary" : "primary"}
                    size="sm"
                    disabled={isApplied || !canApply}
                    onClick={() => setAppliedIds([...appliedIds, rec.action])}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    {isApplied
                      ? "Enrolled"
                      : canApply
                      ? "Apply Action"
                      : "View Only"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
