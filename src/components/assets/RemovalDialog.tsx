"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, Camera, Gift, HandCoins, Recycle, Store, Wrench, X } from "lucide-react";
import { compressImage } from "@/lib/compressImage";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import type { LucideIcon } from "lucide-react";

export type RemovalTarget = { kind: "APPLIANCE" | "VEHICLE"; id: string; name: string; fromShop: boolean };
type Reason = "BROKEN" | "SOLD" | "GIVEN_AWAY" | "SCRAPPED" | "NEVER_HAD" | "NOT_OURS";

const REASONS: { value: Reason; en: string; hi: string; Icon: LucideIcon; shopOnly?: boolean }[] = [
  { value: "BROKEN", en: "Broken", hi: "ख़राब हो गया", Icon: Wrench },
  { value: "SOLD", en: "Sold", hi: "बेच दिया", Icon: HandCoins },
  { value: "GIVEN_AWAY", en: "Given away", hi: "किसी को दे दिया", Icon: Gift },
  { value: "SCRAPPED", en: "Scrapped", hi: "कबाड़ में दिया", Icon: Recycle },
  { value: "NEVER_HAD", en: "We never had it", hi: "हमारे पास कभी नहीं था", Icon: Ban },
  { value: "NOT_OURS", en: "Shop added it by mistake", hi: "दुकान ने ग़लती से जोड़ा", Icon: Store, shopOnly: true },
];
const NO_PHOTO: Reason[] = ["NEVER_HAD", "NOT_OURS"];
/** For these the choice says it all; the two lines are optional. */
const NOTE_OPTIONAL: Reason[] = ["NEVER_HAD", "NOT_OURS"];
const MAX = 3;

/** Ask for an item to be taken off the home: reason, up to three photos, two lines. An admin decides. */
export function RemovalDialog({
  householdId,
  demoRole,
  target,
  initialReason,
  onClose,
  onSent,
}: {
  householdId: string;
  demoRole: string;
  target: RemovalTarget;
  initialReason?: Reason;
  onClose: () => void;
  onSent: () => void;
}) {
  const { lang, t } = useUiPrefs();
  const [reason, setReason] = useState<Reason | null>(initialReason ?? null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const needPhoto = reason !== null && !NO_PHOTO.includes(reason);
  const needNote = reason !== null && !NOTE_OPTIONAL.includes(reason);
  // what's still missing, said out loud next to the button instead of a silently grey button
  const missing =
    reason === null
      ? t("Choose what happened.", "चुनें कि क्या हुआ।")
      : needPhoto && photos.length === 0
        ? t("Add at least one photo.", "कम से कम एक फ़ोटो जोड़ें।")
        : needNote && note.trim().length < 10
          ? t(`Write a line about it (${Math.max(0, 10 - note.trim().length)} more letters).`, `एक लाइन लिखें (${Math.max(0, 10 - note.trim().length)} अक्षर और)।`)
          : null;
  const canSend = missing === null && !busy;

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX - photos.length;
    const picked = Array.from(files).slice(0, room);
    try {
      const out = await Promise.all(picked.map(async (f) => {
        const blob = await compressImage(f);
        return { blob, url: URL.createObjectURL(blob) };
      }));
      setPhotos((p) => [...p, ...out]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function send() {
    if (!reason) return;
    setBusy(true);
    const form = new FormData();
    form.set("kind", target.kind);
    form.set("itemId", target.id);
    form.set("reason", reason);
    form.set("note", note.trim());
    photos.forEach((p, i) => form.append("photos", p.blob, `photo-${i + 1}.jpg`));
    const res = await fetch(`/api/households/${householdId}/removals`, { method: "POST", body: form, headers: { "x-demo-role": demoRole } });
    setBusy(false);
    if (res.ok) {
      toast.success(t("Request sent. Our team will check it, usually within 2 days.", "अनुरोध भेजा गया। हमारी टीम 2 दिन में जाँच करेगी।"), {
        description: t("The item stays counted until then.", "तब तक सामान गिना जाता रहेगा।"),
      });
      onSent();
    } else {
      toast.error((await res.json().catch(() => ({}))).error ?? t("Couldn't send. Try again.", "नहीं भेज पाए।"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center" onClick={() => !busy && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="removal-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-canvas-card p-5 shadow-tier-3 focus:outline-none sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="removal-title" className="font-heading text-2xl font-medium">{t("Ask to remove", "हटाने का अनुरोध")}</h2>
            <p className="text-[14px] text-ink-muted">{target.name}</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label={t("Close", "बंद करें")} className="flex h-10 w-10 items-center justify-center text-ink-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-[15px] font-semibold">{t("1. What happened?", "1. क्या हुआ?")}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {REASONS.filter((r) => !r.shopOnly || target.fromShop).map((r) => (
              <label
                key={r.value}
                className={`flex min-h-[56px] cursor-pointer items-center gap-2.5 border px-3 py-2 text-[14px] ${
                  reason === r.value ? "border-ink bg-ink text-canvas-card" : "border-border hover:border-ink"
                }`}
              >
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="sr-only" />
                <r.Icon className="h-5 w-5 shrink-0" />
                {lang === "hi" ? r.hi : r.en}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <p className="text-[15px] font-semibold">
            {t("2. Photos", "2. फ़ोटो")}{" "}
            <span className="font-normal text-ink-muted">
              {needPhoto ? t("(1 to 3: the item, its label, the damage)", "(1 से 3: सामान, लेबल, ख़राबी)") : t("(optional)", "(ज़रूरी नहीं)")}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative h-24 w-24 overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={t(`Photo ${i + 1}`, `फ़ोटो ${i + 1}`)} className="h-full w-full object-cover" />
                <button
                  onClick={() => setPhotos((all) => all.filter((x) => x !== p))}
                  aria-label={t("Remove photo", "फ़ोटो हटाएँ")}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX && (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 border-2 border-dashed border-border text-[12px] text-ink-muted hover:border-ink hover:text-ink"
              >
                <Camera className="h-6 w-6" />
                {t("Add photo", "फ़ोटो जोड़ें")}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted">
            {t("Location and camera details are removed from photos before they're sent.", "भेजने से पहले फ़ोटो से जगह और कैमरे की जानकारी हटा दी जाती है।")}
          </p>
        </div>

        <label className="mt-5 block">
          <span className="text-[15px] font-semibold">
            {t("3. Tell us in two lines", "3. दो लाइन में बताएँ")}
            {!needNote && reason !== null && <span className="font-normal text-ink-muted"> {t("(optional)", "(वैकल्पिक)")}</span>}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 240))}
            rows={3}
            placeholder={t("e.g. The compressor stopped in May. A mechanic said it can't be repaired.", "जैसे: मई में कंप्रेसर बंद हो गया। मिस्त्री ने कहा ठीक नहीं होगा।")}
            className="mt-2 w-full rounded-sm border border-border bg-canvas-card p-3 text-[15px] focus:border-ink focus:outline-none"
          />
          <span className="block text-right text-[11px] text-ink-muted">{note.length}/240</span>
        </label>

        {missing && (
          <p className="mt-3 text-right text-[13px] font-medium text-warning-text" role="status">
            {missing}
          </p>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} disabled={busy} className="h-12 rounded-md border border-border px-5 text-[15px] hover:border-ink">
            {t("Cancel", "रद्द करें")}
          </button>
          <button onClick={send} disabled={!canSend} className="h-12 rounded-md bg-ink px-5 text-[15px] font-semibold text-canvas-card disabled:opacity-40">
            {busy ? t("Sending…", "भेज रहे हैं…") : t("Send request", "अनुरोध भेजें")}
          </button>
        </div>
        <p className="mt-3 text-[12px] text-ink-muted">
          {t(
            "The item stays on your home until our team approves. You'll get a notification either way.",
            "टीम की मंज़ूरी तक सामान आपके घर पर गिना जाएगा। फ़ैसले की सूचना मिलेगी।",
          )}
        </p>
      </div>
    </div>
  );
}
