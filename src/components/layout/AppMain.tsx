"use client";

import React from "react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { TEXT_ZOOM } from "@/lib/uiPrefs";

/** The page area. `zoom` scales px sizes too, so "A+" enlarges everything evenly. */
export function AppMain({ children }: { children: React.ReactNode }) {
  const { size, lang } = useUiPrefs();
  return (
    <main
      id="main"
      tabIndex={-1}
      lang={lang}
      className="min-h-[70vh] bg-canvas px-4 pb-8 focus:outline-none md:px-10"
      style={size ? { zoom: TEXT_ZOOM[size] } : undefined}
    >
      <div className="mx-auto max-w-[1280px] pt-6 md:pt-8">{children}</div>
    </main>
  );
}
