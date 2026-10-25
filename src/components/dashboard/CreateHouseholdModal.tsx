"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Home, X, Check, AlertCircle } from "lucide-react";

export function CreateHouseholdModal() {
  const { isCreateModalOpen, setCreateModalOpen, setActiveHouseholdId } = useAppStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("UP");
  const [size, setSize] = useState(4);
  const [homeType, setHomeType] = useState("Apartment");
  const [floorAreaM2, setFloorAreaM2] = useState(160);
  const [hasSolar, setHasSolar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isCreateModalOpen) {
        setCreateModalOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCreateModalOpen, setCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !city.trim()) {
      setErrorMsg("Please provide household name and city.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          state,
          size: Number(size),
          homeType,
          floorAreaM2: Number(floorAreaM2),
          hasSolar,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create household");
      }

      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["households"] });
      setActiveHouseholdId(data.household.id);
      setCreateModalOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create household");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-canvas-card p-6 shadow-tier-3">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-primary">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <h3 id="create-modal-title" className="font-heading text-base font-medium text-ink">
                Onboard New Household Tenant
              </h3>
              <p className="text-xs text-ink-muted">
                Starts your household&apos;s record
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreateModalOpen(false)}
            aria-label="Close modal"
            className="rounded-lg p-1 text-ink-muted hover:bg-canvas-subtle hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-critical font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
              Household Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mukherjee Residence"
              className="mt-1 w-full rounded-lg border border-border bg-canvas-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Kolkata"
                className="mt-1 w-full rounded-lg border border-border bg-canvas-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                State / Territory
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-canvas-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              >
                <option value="UP">Uttar Pradesh (IN-UP)</option>
                <option value="DL">Delhi NCR (IN-DL)</option>
                <option value="MH">Maharashtra (IN-MH)</option>
                <option value="KA">Karnataka (IN-KA)</option>
                <option value="HR">Haryana (IN-HR)</option>
                <option value="RJ">Rajasthan (IN-RJ)</option>
                <option value="TN">Tamil Nadu (IN-TN)</option>
                <option value="WB">West Bengal (IN-WB)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                Family Size
              </label>
              <input
                type="number"
                min="1"
                max="15"
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-lg border border-border bg-canvas-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                Dwelling Type
              </label>
              <select
                value={homeType}
                onChange={(e) => setHomeType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-canvas-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              >
                <option value="Apartment">Apartment</option>
                <option value="Independent House">Independent House</option>
                <option value="Villa">Villa</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                Floor Area (m²)
              </label>
              <input
                type="number"
                min="30"
                max="1000"
                value={floorAreaM2}
                onChange={(e) => setFloorAreaM2(parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-lg border border-border bg-canvas-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-emerald-50/50 border border-emerald-100 p-3">
            <input
              type="checkbox"
              id="hasSolarCheck"
              checked={hasSolar}
              onChange={(e) => setHasSolar(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="hasSolarCheck" className="text-xs font-semibold text-emerald-900 cursor-pointer">
              Equipped with Rooftop Solar PV System (Generates offset credits)
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isLoading}
              icon={<Check className="h-4 w-4" />}
            >
              {isLoading ? "Provisioning..." : "Provision Household"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
