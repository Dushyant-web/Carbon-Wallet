"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, MessageSquareText, Phone } from "lucide-react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { Pager, usePaged } from "@/components/ui/Pager";

type Ticket = { id: string; ticket: string; category: string; subject: string; message: string; status: string; response: string | null; createdAt: string; resolvedAt: string | null };

const CATS: [string, string, string][] = [
  ["BILL", "My bill was read wrongly", "मेरा बिल ग़लत पढ़ा गया"],
  ["SHOP_ITEM", "A shop item / removal", "दुकान का सामान / हटाना"],
  ["SCHEME", "A government scheme", "सरकारी योजना"],
  ["MOHALLA", "My mohalla / location", "मोहल्ला / जगह"],
  ["PRIVACY", "My data and privacy", "मेरा डेटा और गोपनीयता"],
  ["ACCOUNT", "Signing in / my account", "लॉग इन / खाता"],
  ["OTHER", "Something else", "कुछ और"],
];
const STATUS: Record<string, [string, string, string]> = {
  OPEN: ["Received", "प्राप्त", "border-warning-border bg-warning-subtle text-warning-text"],
  IN_PROGRESS: ["Being looked at", "जाँच जारी", "border-[#9FB8DA] bg-gov-sky text-gov-navy"],
  RESOLVED: ["Resolved", "हल हुआ", "border-success-border bg-success-subtle text-success-text"],
};

/** Help & complaints: file one, get a ticket number, follow its status and the team's reply. */
export function GrievanceDesk({ householdId }: { householdId?: string }) {
  const { lang, t } = useUiPrefs();
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: "BILL", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const { data } = useQuery<{ tickets: Ticket[] }>({ queryKey: ["grievances"], queryFn: async () => (await fetch("/api/grievances")).json() });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/grievances", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, ...(householdId ? { householdId } : {}) }) });
    setBusy(false);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? t("Couldn't file it. Try again.", "दर्ज नहीं हुआ।"));
    toast.success(t(`Filed. Your ticket number is ${out.ticket}`, `दर्ज हुआ। आपका टिकट नंबर ${out.ticket} है`), { duration: 8000 });
    setForm({ category: form.category, subject: "", message: "" });
    qc.invalidateQueries({ queryKey: ["grievances"] });
  }

  const tickets = data?.tickets ?? [];
  const ticketPages = usePaged(tickets);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <span className="label-caps">{t("Help & complaints", "सहायता और शिकायत")}</span>
        <h1 className="mt-1.5 font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">{t("Tell us what went wrong", "बताइए क्या ग़लत हुआ")}</h1>
        <p className="mt-2 max-w-3xl text-[15px] text-ink-muted">
          {t(
            "Every complaint gets a ticket number. Our team replies here, usually within 2 working days, and you get a notification.",
            "हर शिकायत को एक टिकट नंबर मिलता है। हमारी टीम यहीं जवाब देती है, आम तौर पर 2 कार्य-दिवस में, और आपको सूचना मिलती है।",
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
        <form onSubmit={submit} className="flex flex-col gap-4 border border-gov-navy/30 bg-canvas-card p-5">
          <fieldset>
            <legend className="text-[15px] font-semibold">{t("1. What is it about?", "1. किस बारे में है?")}</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATS.map(([v, en, hi]) => (
                <label key={v} className={`flex min-h-[48px] cursor-pointer items-center gap-2 border px-3 text-[14px] ${form.category === v ? "border-gov-navy bg-gov-navy text-white" : "border-border hover:border-ink"}`}>
                  <input type="radio" name="category" value={v} checked={form.category === v} onChange={() => setForm({ ...form, category: v })} className="sr-only" />
                  {lang === "hi" ? hi : en}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">{t("2. Subject", "2. विषय")}</span>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={120} required minLength={5} className="h-12 rounded-sm border border-border px-3 text-[15px] focus:border-ink focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">{t("3. What happened?", "3. क्या हुआ?")}</span>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} maxLength={2000} required minLength={20} className="rounded-sm border border-border p-3 text-[15px] focus:border-ink focus:outline-none" />
            <span className="text-right text-[11px] text-ink-muted">{form.message.length}/2000</span>
          </label>
          <button disabled={busy} className="h-12 rounded-md bg-gov-navy px-5 text-[15px] font-semibold text-white disabled:opacity-50">
            {busy ? t("Filing…", "दर्ज हो रहा है…") : t("File complaint", "शिकायत दर्ज करें")}
          </button>
          <p className="flex items-center gap-2 text-[12px] text-ink-muted">
            <Phone className="h-3.5 w-3.5" /> {t("For a problem with a shop's sale, you can also call the National Consumer Helpline: 1915.", "दुकान की बिक्री में समस्या हो तो राष्ट्रीय उपभोक्ता हेल्पलाइन 1915 पर भी कॉल करें।")}
          </p>
        </form>

        <section>
          <h2 className="font-heading text-2xl font-medium">{t("Your tickets", "आपके टिकट")}</h2>
          {tickets.length === 0 ? (
            <p className="mt-3 border border-border bg-canvas-card p-5 text-[14px] text-ink-muted">{t("No complaints yet.", "अभी कोई शिकायत नहीं।")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {ticketPages.slice.map((tk) => {
                const [en, hi, cls] = STATUS[tk.status] ?? [tk.status, tk.status, ""];
                return (
                  <li key={tk.id} className="border border-border bg-canvas-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[12px] font-semibold text-gov-blue">{tk.ticket}</p>
                        <p className="text-[15px] font-semibold">{tk.subject}</p>
                        <p className="text-[12px] text-ink-muted">{new Date(tk.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${cls}`}>
                        {tk.status === "RESOLVED" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {lang === "hi" ? hi : en}
                      </span>
                    </div>
                    {tk.response && (
                      <p className="mt-2 flex gap-2 border-l-4 border-gov-navy bg-gov-sky px-3 py-2 text-[14px]">
                        <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" /> {tk.response}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Pager page={ticketPages.page} pages={ticketPages.pages} total={ticketPages.total} onPage={ticketPages.setPage} />
        </section>
      </div>
    </div>
  );
}
