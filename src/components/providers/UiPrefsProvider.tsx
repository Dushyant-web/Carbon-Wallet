"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PREFS, writeUiPrefs, type Lang, type TextSize, type UiPrefs } from "@/lib/uiPrefs";
import { startDomTranslator, type TranslatorStatus } from "@/components/i18n/domTranslator";

type UiPrefsApi = UiPrefs & {
  setLang: (lang: Lang) => void;
  setSize: (size: TextSize) => void;
  toggleCollapsed: () => void;
  setWidth: (width: number) => void;
  /**
   * Pick the English or Hindi string for the current language. In the other 21 languages this returns the English,
   * which the page translator then translates on screen.
   */
  t: (en: string, hi: string) => string;
  /** How the on-screen machine translation is doing ("idle" in English). */
  translation: TranslatorStatus;
};

const Ctx = createContext<UiPrefsApi | null>(null);

/** Seeded from the cookie on the server, so the first paint already has the right language, text size and sidebar. */
export function UiPrefsProvider({ initial, children }: { initial: UiPrefs; children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UiPrefs>(initial);
  const [translation, setTranslation] = useState<TranslatorStatus>("idle");

  // everything not written by hand (and, in Hindi, anything still in English) is translated on screen
  useEffect(() => {
    if (prefs.lang === "en") {
      setTranslation("idle");
      return;
    }
    return startDomTranslator(prefs.lang, setTranslation);
  }, [prefs.lang]);

  const update = useCallback((patch: Partial<UiPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writeUiPrefs(next);
      return next;
    });
  }, []);

  const api = useMemo<UiPrefsApi>(
    () => ({
      ...prefs,
      setLang: (lang) => update({ lang }),
      setSize: (size) => update({ size }),
      toggleCollapsed: () => update({ collapsed: !prefs.collapsed }),
      setWidth: (width) => update({ width }),
      t: (en, hi) => (prefs.lang === "hi" ? hi : en),
      translation,
    }),
    [prefs, update, translation],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const FALLBACK: UiPrefsApi = {
  ...DEFAULT_PREFS,
  setLang: () => {},
  setSize: () => {},
  toggleCollapsed: () => {},
  setWidth: () => {},
  t: (en) => en,
  translation: "idle",
};

/** Works outside the household app too (shop counter, admin): falls back to English, normal size. */
export function useUiPrefs(): UiPrefsApi {
  return useContext(Ctx) ?? FALLBACK;
}
