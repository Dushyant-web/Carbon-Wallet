import { createHash } from "crypto";
import { db } from "@/server/db";
import { buildPassbook, householdIdForPublicToken } from "./passbook.service";

export type ReaderInput =
  | { kind: "code"; code: string }
  | { kind: "token"; token: string }
  | { kind: "uid"; uids: string[] }
  | { kind: "invalid" };

/** Normalises an NFC chip UID: "04:a2:3f…" / "04 A2 3F…" / "04a23f…" → "04A23F…". 4, 7 or 10 byte UIDs. */
export function normalizeUid(raw: string): string | null {
  const hex = raw.replace(/[\s:-]/g, "").toUpperCase();
  return /^[0-9A-F]{8}$|^[0-9A-F]{14}$|^[0-9A-F]{20}$/.test(hex) ? hex : null;
}

/**
 * Understands everything a reader can hand us:
 * - the card's private code "CW1-XXXX-XXXX-XXXX" from its barcode or chip
 * - a shared public link (…/p/<token>), or "cw:<token>"
 * - a chip UID typed by a USB "keyboard" reader, in hex or the 10-digit decimal many cheap readers emit
 */
export function parseReaderInput(raw: string): ReaderInput {
  const input = raw.trim();
  // The card's private barcode / chip code, with or without dashes (barcode guns send it without)
  const card = /^CW1-?([0-9A-HJKMNP-TV-Z]{4})-?([0-9A-HJKMNP-TV-Z]{4})-?([0-9A-HJKMNP-TV-Z]{4})$/i.exec(input);
  if (card) return { kind: "code", code: `CW1${card[1]}${card[2]}${card[3]}`.toUpperCase() };
  const url = /\/p\/([A-Za-z0-9_-]{8,64})(?:[/?#]|$)/.exec(input);
  if (url) return { kind: "token", token: url[1] };
  const cw = /^cw:([A-Za-z0-9_-]{8,64})$/i.exec(input);
  if (cw) return { kind: "token", token: cw[1] };

  if (/^\d{10}$/.test(input)) {
    const be = Number(input).toString(16).toUpperCase().padStart(8, "0");
    const le = be.match(/../g)!.reverse().join("");
    return { kind: "uid", uids: [be, le] };
  }
  const uid = normalizeUid(input);
  return uid ? { kind: "uid", uids: [uid] } : { kind: "invalid" };
}

export async function resolveReaderInput(raw: string): Promise<{ householdId: string; via: "card" | "link"; cardId?: string } | null> {
  const parsed = parseReaderInput(raw);
  if (parsed.kind === "token") {
    const householdId = await householdIdForPublicToken(parsed.token);
    return householdId ? { householdId, via: "link" } : null;
  }
  if (parsed.kind === "code") {
    const hh = await db.household.findUnique({ where: { cardCode: parsed.code }, select: { id: true } });
    return hh ? { householdId: hh.id, via: "card" } : null;
  }
  if (parsed.kind === "uid") {
    const card = await db.card.findFirst({ where: { uid: { in: parsed.uids }, status: "ACTIVE" } });
    if (!card) return null;
    await db.card.update({ where: { id: card.id }, data: { lastUsedAt: new Date() } });
    return { householdId: card.householdId, via: "card", cardId: card.id };
  }
  return null;
}

export type Receipt = Awaited<ReturnType<typeof buildReceipt>>;

/** Receipt payload: the same public-safe aggregates as the public record (no member names, join code or internal ids). */
export async function buildReceipt(householdId: string, via: "card" | "link") {
  const pb = await buildPassbook(householdId);
  const issuedAt = new Date();
  const receiptNo = `R-${issuedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${createHash("sha256")
    .update(`${pb.carbonId}|${issuedAt.toISOString()}`)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase()}`;
  return {
    receiptNo,
    issuedAt: issuedAt.toISOString(),
    via,
    carbonId: pb.carbonId,
    household: { name: pb.household.name, city: pb.household.city, state: pb.household.state, size: pb.household.size },
    current: pb.current,
    inProgress: pb.inProgress,
    months: pb.months.filter((m) => m.status !== "OPEN").slice(-4),
    anchoredCount: pb.anchoredCount,
    publicPath: `/p/${pb.publicToken}`,
  };
}
