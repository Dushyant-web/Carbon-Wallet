"use client";

import { Toaster as Sonner } from "sonner";

/**
 * One toast style for every app: stacked, swipe to dismiss, read out to screen readers.
 * Paper card with a coloured edge per kind, in the Carbon Ledger palette.
 * Use `toast.success(...)`, `toast.error(...)`, `toast(...)` from "sonner".
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      closeButton
      duration={4500}
      gap={10}
      offset={{ top: 72 }}
      mobileOffset={{ top: 64 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border border-l-4 border-l-ink bg-canvas-card px-4 py-3 text-ink shadow-tier-3 font-sans md:w-[380px]",
          title: "text-[14px] font-semibold leading-snug",
          description: "mt-0.5 text-[13px] leading-snug text-ink-muted",
          icon: "mt-0.5 shrink-0",
          success: "!border-l-success [&_[data-icon]]:text-success",
          error: "!border-l-critical [&_[data-icon]]:text-critical",
          warning: "!border-l-warning [&_[data-icon]]:text-warning",
          info: "!border-l-[#2F5D7C] [&_[data-icon]]:text-[#2F5D7C]",
          actionButton: "ml-auto shrink-0 rounded-md bg-ink px-2.5 py-1 text-[12px] font-semibold text-canvas-card",
          cancelButton: "shrink-0 rounded-md border border-border px-2.5 py-1 text-[12px]",
          closeButton:
            "!left-auto !right-1 !top-1 !h-6 !w-6 !translate-x-0 !translate-y-0 rounded-md !border-0 !bg-transparent text-ink-muted hover:!bg-canvas-subtle",
        },
      }}
    />
  );
}
