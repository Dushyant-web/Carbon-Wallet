"use client";

import React, { useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/store";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { Markdownish } from "./Markdownish";

type Msg = { role: "user" | "assistant"; content: string };
export type PartnerAudience = "guest" | "household" | "merchant" | "admin";

const SUGGESTIONS: Record<PartnerAudience, [string, string][]> = {
  household: [
    ["Why is my home red or amber this month?", "इस महीने मेरा घर लाल/पीला क्यों है?"],
    ["How do I remove an AC I sold?", "बेचा हुआ एसी कैसे हटाऊँ?"],
    ["Which government schemes can I get?", "मुझे कौन सी सरकारी योजनाएँ मिल सकती हैं?"],
    ["How do I add my electricity bill?", "बिजली बिल कैसे जोड़ूँ?"],
  ],
  merchant: [
    ["How do I upload my catalogue with photos?", "फ़ोटो के साथ कैटलॉग कैसे अपलोड करूँ?"],
    ["How many items did my shop register this month?", "इस महीने मेरी दुकान ने कितने सामान दर्ज किए?"],
    ["What happens when a customer says 'not ours'?", "ग्राहक 'हमारा नहीं' कहे तो क्या होता है?"],
  ],
  admin: [
    ["What is waiting for me today?", "आज मेरे लिए क्या बाकी है?"],
    ["Which 5 homes had the most CO₂ last month?", "पिछले महीने सबसे ज़्यादा CO₂ वाले 5 घर?"],
    ["How many homes are green, amber and red in Uttar Pradesh?", "उत्तर प्रदेश में कितने घर हरे, पीले, लाल हैं?"],
  ],
  guest: [
    ["What is Carbon Wallet?", "कार्बन वॉलेट क्या है?"],
    ["Is my data safe?", "क्या मेरा डेटा सुरक्षित है?"],
    ["How do shops register what I buy?", "दुकानें मेरी ख़रीद कैसे दर्ज करती हैं?"],
  ],
};

const TOOL_WORDS: Record<string, [string, string]> = {
  my_home: ["Looking at your home…", "आपका घर देख रहे हैं…"],
  my_items: ["Checking your items…", "आपका सामान देख रहे हैं…"],
  my_bills: ["Reading your bills…", "आपके बिल देख रहे हैं…"],
  my_schemes: ["Checking schemes…", "योजनाएँ देख रहे हैं…"],
  my_mohalla: ["Looking at your mohalla…", "मोहल्ला देख रहे हैं…"],
  my_requests: ["Checking your requests…", "आपके अनुरोध देख रहे हैं…"],
  my_forecast: ["Working out next month…", "अगले महीने का अनुमान लगा रहे हैं…"],
  shop_dashboard: ["Looking at your shop…", "दुकान देख रहे हैं…"],
  shop_catalogue: ["Checking your catalogue…", "कैटलॉग देख रहे हैं…"],
  shop_sales: ["Checking your sales…", "बिक्री देख रहे हैं…"],
  platform_overview: ["Checking the platform…", "प्लेटफ़ॉर्म देख रहे हैं…"],
  find_households: ["Searching homes…", "घर खोज रहे हैं…"],
  list_tables: ["Reading the database layout…", "डेटाबेस देख रहे हैं…"],
  run_sql: ["Querying the database (read only)…", "डेटाबेस पढ़ रहे हैं…"],
};

const STORE_KEY = "cw-partner";

/**
 * Partner: a help assistant on every page. It knows the website's rules for the reader's kind of account and,
 * once signed in, can look up their own home / shop (admins: the whole database, read only). The chat lives in
 * this tab only (sessionStorage), so a shared phone doesn't keep it.
 */
export function Partner({ audience }: { audience: PartnerAudience }) {
  const { t, lang } = useUiPrefs();
  const householdId = useAppStore((s) => s.activeHouseholdId);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`${STORE_KEY}:${audience}`) ?? "[]") as Msg[];
      if (Array.isArray(saved)) setMessages(saved.slice(-24));
    } catch {
      // nothing saved
    }
  }, [audience]);
  useEffect(() => {
    try {
      sessionStorage.setItem(`${STORE_KEY}:${audience}`, JSON.stringify(messages.slice(-24)));
    } catch {
      // storage blocked: the chat still works for this page
    }
  }, [messages, audience]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setStatus(t("Thinking…", "सोच रहे हैं…"));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const append = (text: string) =>
      setMessages((m) => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, content: last.content + text };
        return copy;
      });
    try {
      const res = await fetch("/api/partner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-20), householdId: audience === "household" ? householdId : undefined, lang }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        append((await res.json().catch(() => ({}))).error ?? t("Partner couldn't answer. Try again.", "Partner जवाब नहीं दे पाया।"));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l) as { t: string; v?: string };
          if (ev.t === "text" && ev.v) {
            setStatus(null);
            append(ev.v);
          } else if (ev.t === "tool" && ev.v) {
            const w = TOOL_WORDS[ev.v];
            setStatus(w ? t(w[0], w[1]) : t("Looking that up…", "देख रहे हैं…"));
            append(""); // keep the bubble
          } else if (ev.t === "error" && ev.v) append(`\n\n${ev.v}`);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") append(t("\n\nThe connection dropped. Try again.", "\n\nकनेक्शन टूट गया।"));
    } finally {
      setBusy(false);
      setStatus(null);
      abortRef.current = null;
      // an empty answer bubble (e.g. stopped early) is dropped
      setMessages((m) => (m[m.length - 1]?.role === "assistant" && !m[m.length - 1].content.trim() ? m.slice(0, -1) : m));
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-40 flex h-14 ${audience === "household" ? "bottom-[84px] lg:bottom-6" : "bottom-4 sm:bottom-6"} items-center gap-2 rounded-full bg-gov-navy pl-4 pr-5 text-[15px] font-semibold text-white shadow-tier-3 hover:bg-gov-deep print:hidden`}
          aria-label={t("Ask Partner, the help assistant", "Partner से पूछें")}
        >
          <MessageCircleQuestion className="h-6 w-6" />
          Partner
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-label="Partner"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col border border-border bg-canvas-card shadow-tier-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[620px] sm:max-h-[85vh] sm:w-[400px] print:hidden"
        >
          <header className="flex items-center justify-between gap-2 bg-gov-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gov-saffron" />
              <div className="leading-tight">
                <p className="font-semibold">Partner</p>
                <p className="text-[11.5px] text-white/75">
                  {audience === "admin"
                    ? t("Help + read-only database access", "मदद + डेटाबेस (सिर्फ़ पढ़ना)")
                    : t("Ask anything about Carbon Wallet", "कार्बन वॉलेट के बारे में कुछ भी पूछें")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={reset} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10" aria-label={t("New chat", "नई बातचीत")} title={t("New chat", "नई बातचीत")}>
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10" aria-label={t("Close", "बंद करें")}>
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-[14.5px]">
                  {t("Namaste! I'm Partner. Ask me how anything on Carbon Wallet works, or about your own numbers.", "नमस्ते! मैं Partner हूँ। कार्बन वॉलेट के बारे में या अपने आँकड़ों के बारे में कुछ भी पूछें।")}
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS[audience].map(([en, hi]) => (
                    <button key={en} onClick={() => ask(t(en, hi))} className="rounded-md border border-border px-3 py-2 text-left text-[13.5px] hover:border-gov-navy hover:bg-gov-sky">
                      {t(en, hi)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      translate="no"
                      className={`max-w-[88%] rounded-lg px-3 py-2 text-[14px] leading-relaxed ${m.role === "user" ? "bg-gov-navy text-white" : "border border-border bg-canvas"}`}
                    >
                      {m.role === "user" ? <span className="whitespace-pre-wrap">{m.content}</span> : <Markdownish text={m.content} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {status && (
              <p className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gov-saffron" /> {status}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-end gap-2 border-t border-border p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder={t("Type your question…", "अपना सवाल लिखें…")}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-md border border-border bg-canvas-card px-3 py-2.5 text-[14.5px] focus:border-gov-navy focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-md bg-gov-saffron text-white disabled:opacity-40"
              aria-label={t("Send", "भेजें")}
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </form>
          <p className="px-3 pb-2 text-[10.5px] text-ink-light">
            {t("Partner can make mistakes. It only reads; it never changes your data.", "Partner से गलती हो सकती है। यह सिर्फ़ पढ़ता है, कुछ बदलता नहीं।")}
          </p>
        </section>
      )}
    </>
  );
}
