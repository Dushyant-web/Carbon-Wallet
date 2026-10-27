"use client";

import React from "react";
import { Languages } from "lucide-react";
import { LANGUAGES, isLang } from "@/lib/languages";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

/** All 23 languages in their own script. The list itself is never machine translated. */
export function LanguagePicker({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { lang, setLang } = useUiPrefs();
  return (
    <label className={`relative flex items-center gap-1 ${variant === "dark" ? "text-white" : "text-ink"}`} translate="no">
      <Languages className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">Language / भाषा</span>
      <select
        value={lang}
        onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
        className={`h-7 max-w-[150px] cursor-pointer rounded-sm border px-1.5 text-[12.5px] font-semibold ${
          variant === "dark" ? "border-white/40 bg-gov-deep text-white" : "border-border bg-canvas-card text-ink"
        }`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.code === "en" ? "English" : `${l.native} · ${l.name}`}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Under the masthead while a machine-translated language is on. */
export function TranslationNotice() {
  const { lang, translation, setLang } = useUiPrefs();
  if (lang === "en" || lang === "hi") return null;
  const name = LANGUAGES.find((l) => l.code === lang)?.name ?? lang;
  return (
    <div className="border-b border-gov-saffron/40 bg-gov-saffronSoft px-3 py-1.5 text-[12.5px] md:px-6" translate="no" role="status">
      {translation === "unavailable" ? (
        <>
          {name} translation isn&apos;t switched on yet on this server, so some text stays in English.{" "}
        </>
      ) : (
        <>
          {translation === "working" ? `Translating into ${name}…` : `Translated into ${name} by AI. Some words may be wrong.`}{" "}
        </>
      )}
      <button onClick={() => setLang("en")} className="font-semibold underline">
        English
      </button>
      {" · "}
      <button onClick={() => setLang("hi")} className="font-semibold underline" lang="hi">
        हिन्दी
      </button>
    </div>
  );
}
