"use client";

import React from "react";
import type { Receipt } from "@/server/services/card.service";

export type PaperWidth = 58 | 80;

function Row({ left, right, bold = false }: { left: React.ReactNode; right: React.ReactNode; bold?: boolean }) {
  return (
    <div className={`flex items-baseline gap-1 ${bold ? "font-semibold" : ""}`}>
      <span className="shrink-0">{left}</span>
      <span className="mb-[0.28em] min-w-[1ch] flex-1 border-b border-dotted border-black/60" aria-hidden />
      <span className="shrink-0 tabular-nums">{right}</span>
    </div>
  );
}

function Rule({ double = false }: { double?: boolean }) {
  return <div className={`my-[0.6em] ${double ? "border-t-[3px] border-double" : "border-t border-dashed"} border-black`} />;
}

/** Monochrome receipt laid out for 58 mm / 80 mm thermal printers (48 / 72 mm printable width). */
export function ThermalReceipt({ receipt, paper = 80 }: { receipt: Receipt; paper?: PaperWidth; origin?: string }) {
  const printable = paper === 80 ? "72mm" : "48mm";
  const fontSize = paper === 80 ? "11.5px" : "9.5px";
  const issued = new Date(receipt.issuedAt);
  const categories = Object.entries(receipt.current.categories)
    .filter(([, kg]) => kg > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="cw-receipt mx-auto bg-white px-[3mm] py-[4mm] font-mono leading-[1.45] text-black"
      style={{ width: printable, fontSize, boxSizing: "content-box" }}
    >
      <div className="text-center">
        <p className="text-[1.45em] font-semibold tracking-[0.18em]">CARBON WALLET</p>
        <p className="text-[0.92em]">Household carbon receipt</p>
      </div>
      <Rule />
      <Row left="Receipt" right={receipt.receiptNo} />
      <Row
        left="Date"
        right={issued.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      />
      <Row left="Read via" right={receipt.via === "card" ? "Carbon Card" : "Shared link"} />
      <Rule />
      <p className="text-[0.85em] tracking-[0.12em]">CARBON ID</p>
      <p className="text-[1.25em] font-semibold tracking-[0.06em]">{receipt.carbonId}</p>
      <p className="mt-[0.2em] font-semibold">{receipt.household.name}</p>
      <p>
        {receipt.household.city}, {receipt.household.state} · {receipt.household.size} people
      </p>
      <Rule double />
      <Row left="MONTH" right={receipt.current.label} bold />
      <Row left="TOTAL" right={`${receipt.current.totalKg.toFixed(1)} kg`} bold />
      <Row left="Per person" right={`${receipt.current.perPersonKg} kg`} />
      <Row left="Vs prev month" right={`${receipt.current.trendPct > 0 ? "+" : ""}${receipt.current.trendPct}%`} />
      {categories.length > 0 && (
        <>
          <Rule />
          {categories.map(([cat, kg]) => (
            <Row key={cat} left={cat} right={`${kg.toFixed(1)} kg`} />
          ))}
        </>
      )}
      {receipt.months.length > 0 && (
        <>
          <Rule />
          <div className="flex justify-between text-[0.85em] tracking-[0.08em]">
            <span>MONTH</span>
            <span>KG · STATUS</span>
          </div>
          {receipt.months.map((m) => (
            <Row key={m.month} left={m.label} right={`${m.totalKg} · ${m.status === "ANCHORED" ? "ANCHORED✓" : "RECORDED"}`} />
          ))}
        </>
      )}
      {receipt.inProgress && (
        <p className="mt-[0.4em] text-[0.9em]">
          {receipt.inProgress.label} so far: {receipt.inProgress.totalKg} kg (in progress)
        </p>
      )}
      <Rule double />
      <p className="text-center text-[0.9em]">Your full record is in the Carbon Wallet app.</p>
      <p className="text-center text-[0.9em]">Scan your card at any Carbon Wallet kiosk.</p>
      <Rule />
      <p className="text-center text-[0.85em]">Totals only · no personal details</p>
      <p className="text-center text-[0.85em]">Estimates. Not a tax invoice.</p>
      <p className="mt-[0.5em] text-center font-semibold">Thank you for measuring</p>
    </div>
  );
}
