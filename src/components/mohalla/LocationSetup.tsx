"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Crosshair, Keyboard, Lock, MapPin } from "lucide-react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

const PinMap = dynamic(() => import("./PinMap").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse bg-canvas-subtle" />,
});

type Place = { name: string; district: string; state: string };
type Point = { lat: number; lng: number };

/**
 * "Are you at home now?" Yes → the phone's GPS. No → type the pincode, pick the area, drag the pin onto the house.
 * Either way only a hexagon about 120 m across is stored, never the point.
 */
export function LocationSetup({ householdId, demoRole, onSaved, onCancel }: { householdId: string; demoRole: string; onSaved: () => void; onCancel?: () => void }) {
  const { t } = useUiPrefs();
  const [mode, setMode] = useState<"choose" | "gps" | "manual">("choose");
  const [point, setPoint] = useState<Point | null>(null);
  const [pin, setPin] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);

  function useGps() {
    if (!("geolocation" in navigator)) return toast.error(t("This phone can't share its location. Enter the pincode instead.", "यह फ़ोन लोकेशन नहीं दे सकता। पिनकोड डालें।"));
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMode("gps");
      },
      () => {
        setBusy(false);
        toast.error(t("Location was not allowed. You can enter the pincode instead.", "लोकेशन की अनुमति नहीं मिली। पिनकोड डालें।"));
        setMode("manual");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function findPin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[1-9][0-9]{5}$/.test(pin)) return toast.error(t("A pincode has 6 digits.", "पिनकोड 6 अंकों का होता है।"));
    setBusy(true);
    const res = await fetch(`/api/geo/pincode/${pin}`);
    setBusy(false);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? t("Couldn't find that pincode.", "पिनकोड नहीं मिला।"));
    setPlaces(out.places ?? []);
    setPlace(out.places?.[0] ?? null);
    if (out.center) setPoint(out.center);
    else toast(t("Map position not found: zoom and drag the pin to your home.", "नक्शे पर जगह नहीं मिली: पिन को घर पर खींचें।"));
    if (!out.center) setPoint({ lat: 22.5, lng: 79 });
  }

  async function save() {
    if (!point) return;
    setBusy(true);
    const res = await fetch(`/api/households/${householdId}/location`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-demo-role": demoRole },
      body: JSON.stringify({
        lat: point.lat,
        lng: point.lng,
        source: mode === "gps" ? "GPS" : "MANUAL",
        ...(mode === "manual" && pin ? { pincode: pin } : {}),
        ...(place ? { locality: place.name, district: place.district } : {}),
      }),
    });
    setBusy(false);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(out.error ?? t("Couldn't save the place.", "जगह सेव नहीं हुई।"));
    toast.success(t("Saved. Your mohalla is ready.", "सेव हो गया। आपका मोहल्ला तैयार है।"));
    onSaved();
  }

  return (
    <section className="border border-ink bg-canvas-card p-5 md:p-6">
      <h2 className="font-heading text-2xl font-medium">{t("Where is your home?", "आपका घर कहाँ है?")}</h2>
      <p className="mt-1 flex items-start gap-2 text-[14px] text-ink-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        {t(
          "We keep only a rough area about 120 metres across, never your exact spot. It's used for your mohalla and its weather.",
          "हम सिर्फ़ लगभग 120 मीटर का इलाका रखते हैं, आपकी सटीक जगह नहीं। यह मोहल्ले और मौसम के लिए है।",
        )}
      </p>

      {mode === "choose" && (
        <div className="mt-5">
          <p className="text-[16px] font-semibold">{t("Are you at home right now?", "क्या आप अभी घर पर हैं?")}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button disabled={busy} onClick={useGps} className="flex min-h-[72px] items-center gap-3 border-2 border-ink bg-ink px-4 text-left text-canvas-card disabled:opacity-60">
              <Crosshair className="h-7 w-7 shrink-0" />
              <span>
                <span className="block text-[16px] font-semibold">{busy ? t("Finding you…", "ढूँढ रहे हैं…") : t("Yes, use my location", "हाँ, मेरी लोकेशन लें")}</span>
                <span className="text-[13px] opacity-80">{t("The phone asks your permission", "फ़ोन अनुमति माँगेगा")}</span>
              </span>
            </button>
            <button onClick={() => setMode("manual")} className="flex min-h-[72px] items-center gap-3 border-2 border-border px-4 text-left hover:border-ink">
              <Keyboard className="h-7 w-7 shrink-0" />
              <span>
                <span className="block text-[16px] font-semibold">{t("No, I'll enter the pincode", "नहीं, पिनकोड डालूँगा")}</span>
                <span className="text-[13px] text-ink-muted">{t("Then drop a pin on the map", "फिर नक्शे पर पिन लगाएँ")}</span>
              </span>
            </button>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="mt-3 text-[14px] underline underline-offset-2">
              {t("Cancel", "रद्द करें")}
            </button>
          )}
        </div>
      )}

      {mode === "manual" && (
        <form onSubmit={findPin} className="mt-5 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold">{t("Pincode", "पिनकोड")}</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="201301"
              className="h-12 w-40 rounded-sm border border-border px-3 font-mono text-lg tracking-widest focus:border-ink focus:outline-none"
            />
          </label>
          <button disabled={busy} className="h-12 rounded-md bg-ink px-5 font-semibold text-canvas-card disabled:opacity-50">
            {busy ? t("Finding…", "ढूँढ रहे हैं…") : t("Find", "खोजें")}
          </button>
          {places.length > 0 && (
            <label className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="text-[14px] font-semibold">{t("Your area", "आपका इलाका")}</span>
              <select
                value={place?.name ?? ""}
                onChange={(e) => setPlace(places.find((p) => p.name === e.target.value) ?? null)}
                className="h-12 rounded-sm border border-border bg-canvas-card px-3 focus:border-ink focus:outline-none"
              >
                {places.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}, {p.district}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form>
      )}

      {point && mode !== "choose" && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold">
            <MapPin className="h-4 w-4 text-secondary" /> {t("Drag the pin onto your home, or tap the map", "पिन को अपने घर पर खींचें या नक्शे पर टैप करें")}
          </p>
          <PinMap center={point} onMove={setPoint} label={t("Map: drag the pin to your home", "नक्शा: पिन को घर पर खींचें")} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy} onClick={save} className="h-12 rounded-md bg-secondary px-6 text-[15px] font-semibold text-white hover:bg-secondary-hover disabled:opacity-50">
              {busy ? t("Saving…", "सेव हो रहा है…") : t("This is my home: save", "यही मेरा घर है: सेव करें")}
            </button>
            <button onClick={() => { setMode("choose"); setPoint(null); }} className="h-12 rounded-md border border-border px-5 hover:border-ink">
              {t("Start again", "फिर से")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
