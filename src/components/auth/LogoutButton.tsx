"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function LogoutButton({ redirectTo = "/login", className = "" }: { redirectTo?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    queryClient.clear();
    window.location.href = redirectTo;
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className={`h-8 rounded-md border border-border bg-canvas-card px-3 text-xs font-medium text-ink hover:border-ink disabled:opacity-50 ${className}`}
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
