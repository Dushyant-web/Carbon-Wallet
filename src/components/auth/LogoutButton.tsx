"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { forgetBrowserData } from "@/components/providers/QueryProvider";

export function LogoutButton({ redirectTo = "/login", className = "" }: { redirectTo?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useUiPrefs();

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    queryClient.clear();
    forgetBrowserData();
    window.location.href = redirectTo;
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className={`h-8 rounded-md border border-border bg-canvas-card px-3 text-xs font-medium text-ink hover:border-ink disabled:opacity-50 ${className}`}
    >
      {busy ? t("Logging out…", "लॉग आउट…") : t("Log out", "लॉग आउट")}
    </button>
  );
}
