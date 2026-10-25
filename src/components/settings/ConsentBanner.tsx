"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** Asks once for agreement to the current privacy notice (accounts made before it, or without the tick). */
export function ConsentBanner() {
  const qc = useQueryClient();
  const { data } = useQuery<{ agreed: boolean; current: string }>({
    queryKey: ["me", "consent"],
    queryFn: async () => {
      const res = await fetch("/api/me/consent");
      if (!res.ok) throw new Error("consent unavailable");
      return res.json();
    },
  });
  if (!data || data.agreed) return null;
  async function agree() {
    await fetch("/api/me/consent", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["me", "consent"] });
  }
  return (
    <div role="region" aria-label="Privacy notice" className="fixed inset-x-0 bottom-16 z-40 mx-auto w-[min(640px,calc(100%-24px))] rounded-md border border-border bg-canvas-card p-4 shadow-tier-3 lg:bottom-6">
      <p className="text-sm">
        We&apos;ve written down, in plain words, what Carbon Wallet keeps and how you can download or delete it.{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Read the privacy notice
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={agree} className="h-9 rounded-md bg-ink px-4 text-sm text-canvas">
          I agree
        </button>
        <Link href="/settings" className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:border-ink">
          My data &amp; deleting it
        </Link>
      </div>
    </div>
  );
}
