"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store";
import { useCreateActivity } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/Button";
import { X, Plus, AlertCircle } from "lucide-react";
import { Category } from "@/types";

export function LogActivityModal() {
  const { activeHouseholdId, isLogModalOpen, setLogModalOpen } = useAppStore();
  const { can, role } = usePermissions();
  const createMutation = useCreateActivity(activeHouseholdId);

  const [category, setCategory] = useState<Category>("Electricity");
  const [type, setType] = useState("ac_cooling");
  const [quantity, setQuantity] = useState(6);
  const [unit, setUnit] = useState("hours");
  const [notes, setNotes] = useState("Afternoon AC run");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isLogModalOpen) {
        setLogModalOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLogModalOpen, setLogModalOpen]);

  if (!isLogModalOpen) return null;

  const canCreate = can("activity:create");

  const handleCategoryChange = (newCat: Category) => {
    setCategory(newCat);
    setErrorMsg(null);
    if (newCat === "Electricity") {
      setType("ac_cooling");
      setQuantity(6);
      setUnit("hours");
      setNotes("Living room AC cooling cycle");
    } else if (newCat === "Transport") {
      setType("petrol_car");
      setQuantity(25);
      setUnit("km");
      setNotes("City commute driving");
    } else if (newCat === "Travel") {
      setType("flight_domestic_economy");
      setQuantity(1200);
      setUnit("km");
      setNotes("Domestic short-haul flight leg");
    } else if (newCat === "Food") {
      setType("grocery_basket");
      setQuantity(2);
      setUnit("basket");
      setNotes("Weekly grocery and dietary basket");
    } else if (newCat === "Waste") {
      setType("solid_waste_unsegregated");
      setQuantity(15);
      setUnit("kg");
      setNotes("Municipal waste disposal");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!canCreate) {
      setErrorMsg(`Role '${role}' is not authorized to log activities (403 Forbidden). Switch role in TopBar to Owner, Admin, or Member.`);
      return;
    }

    try {
      await createMutation.mutateAsync({
        category,
        type,
        quantity: Number(quantity),
        unit,
        notes,
        occurredOn: new Date(),
        source: "MANUAL",
      });
      setLogModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to log activity");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-tier-3">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 id="log-modal-title" className="font-heading text-base font-bold text-ink">
                Log Carbon Activity Event
              </h3>
              <p className="text-xs text-ink-muted">
                Emissions pipeline: Activity → Factor → Event → Rollup
              </p>
            </div>
          </div>
          <button
            onClick={() => setLogModalOpen(false)}
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

        {!canCreate && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              You are currently viewing as <strong>{role}</strong>. In the demo, Viewers are blocked with 403 on edit actions.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Activity Category
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as Category)}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="Electricity">Electricity & HVAC Cooling</option>
              <option value="Transport">Vehicle Commute (Petrol/Diesel/CNG)</option>
              <option value="Travel">Aviation / Rail Travel</option>
              <option value="Food">Food & Dietary Baskets</option>
              <option value="Waste">Municipal Solid Waste</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Description / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              placeholder="e.g. Master Bedroom Inverter AC 6 hrs"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLogModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Calculating..." : "Record & Compute"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
