"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { useTilt } from "@/hooks/useTilt";
import { CardBack, CardFront, CARD_H, CARD_W } from "./CardArt";

type PairedCard = { id: string; label: string; uidMasked: string; status: string; createdAt: string; lastUsedAt: string | null };

type Props = {
  householdId: string;
  carbonId: string;
  householdName: string;
  stateCode: string;
  issuedOn: string;
  publicToken: string;
  cardCode: string;
  canManage: boolean;
};

const btn = "h-9 rounded-md border border-border bg-canvas-card px-3 text-sm hover:border-ink disabled:opacity-45";
const btnPrimary = "h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-45";

function download(svg: SVGSVGElement | null, filename: string) {
  if (!svg) return;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CardStudio({ householdId, carbonId, householdName, stateCode, issuedOn, publicToken, cardCode, canManage }: Props) {
  const { demoRole } = useAppStore();
  const queryClient = useQueryClient();
  const tilt = useTilt(14);
  const [flipped, setFlipped] = useState(false);
  const [origin, setOrigin] = useState("");
  const [uid, setUid] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [hasNfc, setHasNfc] = useState(false);
  const frontPrint = useRef<SVGSVGElement>(null);
  const backPrint = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
    setHasNfc(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  const publicUrl = `${origin}/p/${publicToken}`; // shared only when the owner chooses to
  const prettyCode = `CW1-${cardCode.slice(3, 7)}-${cardCode.slice(7, 11)}-${cardCode.slice(11, 15)}`;
  const art = { carbonId, householdName, stateCode, issuedYear: new Date(issuedOn).getFullYear(), cardCode };

  async function reissue() {
    setMsg(null);
    const res = await fetch(`/api/households/${householdId}/cards/reissue`, { method: "POST", headers: { "x-demo-role": demoRole } });
    if (res.ok) {
      setMsg({ kind: "ok", text: "New card code issued. Cards printed with the old code no longer work; print and write a new one." });
      queryClient.invalidateQueries({ queryKey: ["household", householdId, "passbook"] });
    } else {
      setMsg({ kind: "err", text: (await res.json().catch(() => ({}))).error ?? "Couldn't reissue the code." });
    }
  }

  const cards = useQuery<{ cards: PairedCard[] }>({
    queryKey: ["household", householdId, "cards"],
    queryFn: async () => {
      const res = await fetch(`/api/households/${householdId}/cards`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("cards failed");
      return res.json();
    },
  });

  async function pair(rawUid: string) {
    setMsg(null);
    const res = await fetch(`/api/households/${householdId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": demoRole },
      body: JSON.stringify({ uid: rawUid }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ kind: "ok", text: `Card ${body.card.uidMasked} paired. Tap it on the reader to print a receipt.` });
      setUid("");
      queryClient.invalidateQueries({ queryKey: ["household", householdId, "cards"] });
    } else {
      setMsg({ kind: "err", text: body.error ?? "Couldn't pair the card." });
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/households/${householdId}/cards/${id}`, { method: "DELETE", headers: { "x-demo-role": demoRole } });
    queryClient.invalidateQueries({ queryKey: ["household", householdId, "cards"] });
  }

  async function writeChip() {
    setMsg(null);
    try {
      const ndef = new NDEFReader();
      // The chip holds only the private code, so an ordinary phone tap shows nothing personal
      await ndef.write({ records: [{ recordType: "text", data: cardCode }] });
      setMsg({ kind: "ok", text: "Chip written. Carbon Wallet kiosks can now read this card by tap as well as by barcode." });
    } catch (e) {
      setMsg({ kind: "err", text: `Couldn't write the chip: ${e instanceof Error ? e.message : "unknown error"}` });
    }
  }

  async function scanToPair() {
    setMsg({ kind: "ok", text: "Hold the card against the back of this phone…" });
    try {
      const ndef = new NDEFReader();
      const controller = new AbortController();
      ndef.onreading = (event) => {
        controller.abort();
        pair(event.serialNumber);
      };
      await ndef.scan({ signal: controller.signal });
    } catch (e) {
      setMsg({ kind: "err", text: `NFC scan failed: ${e instanceof Error ? e.message : "unknown error"}` });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(260px,320px)_1fr]">
      {/* 3D preview */}
      <div className="flex flex-col items-center gap-3">
        <div
          onPointerMove={tilt.onPointerMove}
          onPointerLeave={tilt.onPointerLeave}
          onClick={() => setFlipped((f) => !f)}
          className="w-full max-w-[300px] cursor-pointer select-none"
          style={{
            aspectRatio: `${CARD_W} / ${CARD_H}`,
            perspective: "1400px",
            // Shadow lives here: a filter on the flipping element would flatten the 3D and break backface hiding.
            filter: "drop-shadow(0 26px 30px rgba(22,36,27,.38))",
          }}
          aria-hidden
        >
          <div
            ref={tilt.targetRef}
            className="relative h-full w-full"
            style={{ transformStyle: "preserve-3d", transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))" }}
          >
            <div
              className="relative h-full w-full transition-transform duration-700 motion-reduce:transition-none"
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateY(${flipped ? 180 : 0}deg)`,
              }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-[5.5%/3.5%]" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <CardFront {...art} className="h-full w-full" />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(circle at var(--gx,50%) var(--gy,30%), rgba(255,240,210,.22), transparent 45%)" }}
                />
              </div>
              <div
                className="absolute inset-0 overflow-hidden rounded-[5.5%/3.5%]"
                style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              >
                <CardBack {...art} className="h-full w-full" />
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => setFlipped((f) => !f)} className={btn}>
          {flipped ? "Show front" : "Show back"}
        </button>
        <p className="text-center text-[11px] text-ink-muted">Standard card size, with a tap chip inside</p>
      </div>

      {/* Steps */}
      <ol className="flex flex-col">
        <li className="border-t border-ink py-4">
          <p className="label-caps">01 · Print</p>
          <p className="mt-1 text-sm text-ink-muted">
            Download both sides and take them to any card-printing shop. Ask for a plastic card with a tap (NFC) chip inside;
            the gold parts can be printed in gold foil or gold ink.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btn} onClick={() => download(frontPrint.current, `${carbonId}-front.svg`)} disabled={!origin}>
              Download front
            </button>
            <button className={btn} onClick={() => download(backPrint.current, `${carbonId}-back.svg`)} disabled={!origin}>
              Download back
            </button>
          </div>
        </li>

        <li className="border-t border-border py-4">
          <p className="label-caps">02 · Your private card code</p>
          <p className="mt-1 text-sm text-ink-muted">
            The barcode and the chip hold only this code. Carbon Wallet kiosks turn it into your record; any other scanner just
            sees the code, never your data.
          </p>
          <p className="mt-2 font-mono text-sm tracking-wider">{prettyCode}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasNfc ? (
              <button className={btnPrimary} onClick={writeChip}>
                Write the code to the chip
              </button>
            ) : (
              <span className="text-xs text-ink-muted">To write the chip, open this page in Chrome on an Android phone.</span>
            )}
            {canManage && (
              <button className={btn} onClick={reissue}>
                Lost the card? Reissue the code
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Want to show your totals to someone? Share your public link on purpose:{" "}
            <button className="underline underline-offset-2 hover:text-ink" onClick={() => navigator.clipboard.writeText(publicUrl).catch(() => null)}>
              copy link
            </button>
          </p>
        </li>

        <li className="border-t border-border py-4">
          <p className="label-caps">03 · Link the card to your home</p>
          <p className="mt-1 text-sm text-ink-muted">
            So that Carbon Wallet kiosks recognise your card. Tap it on your phone, or type the number printed on the chip.
          </p>
          {canManage ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hasNfc && (
                <button className={btnPrimary} onClick={scanToPair}>
                  Tap card to link
                </button>
              )}
              <input
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="Chip number, e.g. 04:A2:3F:1B:2C:80:90"
                className="h-9 min-w-[240px] flex-1 rounded-sm border border-border bg-canvas-card px-3 font-mono text-sm focus:border-ink focus:outline-none"
              />
              <button className={btn} onClick={() => pair(uid)} disabled={uid.trim().length < 8}>
                Link
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">Only the household owner or admin can pair cards.</p>
          )}
          {msg && (
            <p className={`mt-2 text-xs ${msg.kind === "ok" ? "text-success-text" : "text-critical-text"}`}>{msg.text}</p>
          )}
          {(cards.data?.cards.length ?? 0) > 0 && (
            <table className="mt-4 w-full text-sm">
              <tbody>
                {cards.data!.cards.map((c) => (
                  <tr key={c.id} className="border-b border-border/70">
                    <td className="py-2">{c.label}</td>
                    <td className="py-2 font-mono text-xs">{c.uidMasked}</td>
                    <td className="py-2 font-mono text-[11px] uppercase text-ink-muted">
                      {c.status === "ACTIVE" ? (c.lastUsedAt ? `used ${new Date(c.lastUsedAt).toLocaleDateString("en-IN")}` : "never used") : "revoked"}
                    </td>
                    <td className="py-2 text-right">
                      {canManage && c.status === "ACTIVE" && (
                        <button onClick={() => revoke(c.id)} className="text-xs text-ink-muted underline hover:text-critical-text">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </li>

        <li className="border-t border-border py-4">
          <p className="label-caps">04 · Use it at a kiosk</p>
          <p className="mt-1 text-sm text-ink-muted">
            Scan or tap the card at a Carbon Wallet kiosk and it reads your record and prints a paper receipt straight away.
            Anyone else&apos;s phone or scanner app only ever sees the code. Your public page opens only from a link you share.
          </p>
        </li>
      </ol>

      {/* print-resolution artwork with bleed, used for the downloads */}
      {origin && (
        <div className="hidden" aria-hidden>
          <CardFront ref={frontPrint} {...art} bleed />
          <CardBack ref={backPrint} {...art} bleed />
        </div>
      )}
    </div>
  );
}
