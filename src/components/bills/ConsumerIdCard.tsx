"use client";

import React, { useEffect, useState } from "react";
import { Check, IdCard, Pencil } from "lucide-react";

/**
 * The home's electricity consumer ID, shown at the top of the bills page. Display only: it comes from the latest
 * bill (masked) or what the person typed, which is kept in this browser and never sent anywhere.
 */
export function ConsumerIdCard({ householdId, fromBill }: { householdId: string | null; fromBill: string | null }) {
  const key = `cw-consumer-id:${householdId ?? "none"}`;
  const [typed, setTyped] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      setTyped(localStorage.getItem(key) ?? "");
    } catch {
      setTyped("");
    }
  }, [key]);

  const shown = typed || fromBill;

  function save() {
    const value = draft.trim().slice(0, 30);
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      // private mode: it simply isn't remembered
    }
    setTyped(value);
    setEditing(false);
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border border-border bg-canvas-card px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <IdCard className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
        <div className="min-w-0">
          <span className="label-caps">Consumer ID</span>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="As printed on your bill"
              className="mt-1 block w-64 max-w-full border border-border bg-white px-2 py-1 font-mono text-sm"
            />
          ) : (
            <p className="mt-0.5 font-mono text-lg tracking-wide">{shown ?? "Not added yet"}</p>
          )}
        </div>
      </div>
      {editing ? (
        <button onClick={save} className="inline-flex items-center gap-1.5 text-[13px] font-medium underline underline-offset-2">
          <Check className="h-4 w-4" /> Save
        </button>
      ) : (
        <button
          onClick={() => {
            setDraft(typed);
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium underline underline-offset-2"
        >
          <Pencil className="h-4 w-4" /> {shown ? "Edit" : "Add"}
        </button>
      )}
    </section>
  );
}
