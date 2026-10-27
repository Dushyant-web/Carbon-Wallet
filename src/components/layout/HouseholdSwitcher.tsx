"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store";
import { useHouseholds } from "@/hooks/useHousehold";
import { ChevronDown, Check, Home, Plus } from "lucide-react";

export function HouseholdSwitcher({ onOpenCreate }: { onOpenCreate?: () => void }) {
  const { activeHouseholdId, setActiveHouseholdId } = useAppStore();
  const { data, isLoading } = useHouseholds();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const households = data?.households || [];
  const activeHh = households.find((h: { id: string }) => h.id === activeHouseholdId) || households[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // The store defaults to a demo id; snap to a household this user actually belongs to.
  useEffect(() => {
    if (activeHh && activeHh.id !== activeHouseholdId) setActiveHouseholdId(activeHh.id);
  }, [activeHh, activeHouseholdId, setActiveHouseholdId]);

  if (isLoading) {
    return <div className="h-12 w-64 animate-pulse rounded-lg bg-slate-200" />;
  }

  if (!activeHh) {
    return (
      <button
        onClick={onOpenCreate}
        className="flex h-10 items-center gap-2 rounded-md border border-ink px-3 text-sm font-medium hover:bg-ink hover:text-canvas-card"
      >
        <Plus className="h-4 w-4" /> Create your household
      </button>
    );
  }

  const getScoreBadge = (score: number) => {
    if (score >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (score >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 60) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-rose-100 text-rose-800 border-rose-300";
  };

  // Only people in more than one household get a switcher; everyone else just sees their home
  const canSwitch = households.length > 1;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => canSwitch && setIsOpen(!isOpen)}
        disabled={!canSwitch}
        aria-haspopup={canSwitch ? "listbox" : undefined}
        aria-expanded={canSwitch ? isOpen : undefined}
        aria-label={canSwitch ? `Switch household. Current: ${activeHh.name}` : activeHh.name}
        className={`flex items-center gap-3 rounded-xl border border-border bg-canvas-card px-3.5 py-2 text-left shadow-tier-1 transition-all focus-visible:outline-2 focus-visible:outline-ink ${
          canSwitch ? "hover:border-border-hover hover:bg-canvas-subtle" : "cursor-default"
        }`}
      >
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            activeHh.score === null ? "bg-border" : activeHh.score >= 75 ? "bg-secondary" : activeHh.score >= 60 ? "bg-warning" : "bg-critical"
          }`}
        />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="max-w-[9rem] truncate text-sm font-bold text-ink sm:max-w-none">
              {activeHh.name}
            </span>
            {activeHh.score !== null && (
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-bold border tabular-nums ${getScoreBadge(
                  activeHh.score
                )}`}
              >
                Score {activeHh.score}
              </span>
            )}
          </div>
          <span className="hidden text-[11px] text-ink-muted sm:block">
            {activeHh.city}, {activeHh.state} • {activeHh.size} people • {activeHh.currentEmissions} kg CO₂e a month
          </span>
        </div>
        {canSwitch && <ChevronDown className="ml-2 h-4 w-4 text-ink-muted" />}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-border bg-canvas-card p-1.5 shadow-tier-3">
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted border-b border-border">
            <span>Your households ({households.length})</span>
            {onOpenCreate && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreate();
                }}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 py-1">
            {households.map((h: {
              id: string;
              name: string;
              city: string;
              state: string;
              size: number;
              currentEmissions: number;
              score: number;
            }) => {
              const isSelected = h.id === activeHh.id;
              return (
                <button
                  key={h.id}
                  onClick={() => {
                    setActiveHouseholdId(h.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
                    isSelected ? "bg-emerald-50 text-primary font-semibold" : "hover:bg-slate-50 text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Home className={`h-4 w-4 ${isSelected ? "text-primary" : "text-ink-muted"}`} />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold leading-tight">{h.name}</span>
                      <span className="text-[11px] text-ink-muted">
                        {h.city} • {h.currentEmissions} kg CO₂e
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.score !== null && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold border tabular-nums ${getScoreBadge(
                          h.score
                        )}`}
                      >
                        {h.score}
                      </span>
                    )}
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
