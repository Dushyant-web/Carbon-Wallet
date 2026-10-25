import { db } from "@/server/db";
import { EngineError, engineGetStatement, engineStatementStatus } from "@/server/engine";
import { ensureHouseholdIdentity, newPublicToken } from "@/server/services/identity.service";

/*
 * Sharing sealed months with a bank, an employer or a housing society. The household picks the months and how
 * long the link lasts; the verifier sees the Carbon ID, the city and each month's sealed totals, and can check
 * every month against the public chain themselves. Never shown: member names, the card code, bills or files.
 */

export const SHARE_LIMITS = { maxMonths: 12, minDays: 1, maxDays: 180, defaultDays: 30 };
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ShareError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type SharedMonth = {
  period: string;
  totalKg: number;
  byCategory: Record<string, number>;
  verifiedReductionsKg: number;
  factorSet: string;
  issuedAt: string;
  anchor: { chain: string; txHash: string; explorerUrl: string | null; blockNumber: number | null; anchoredAt: string } | null;
  proof: { statement: Record<string, unknown>; salt: string; proof: string[]; batch_id: number };
};

export type PublicShare =
  | { state: "not_found" | "revoked" | "expired" }
  | { state: "ok"; carbonId: string; city: string; region: string; expiresAt: string; months: SharedMonth[] };

const parseMonths = (s: string): string[] => {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
};

export async function createShare(householdId: string, userId: string, months: string[], days: number = SHARE_LIMITS.defaultDays, label?: string) {
  const unique = [...new Set(months)].sort();
  if (unique.length === 0 || unique.length > SHARE_LIMITS.maxMonths || !unique.every((m) => MONTH_RE.test(m))) {
    throw new ShareError(`Pick 1 to ${SHARE_LIMITS.maxMonths} months.`);
  }
  if (!(days >= SHARE_LIMITS.minDays && days <= SHARE_LIMITS.maxDays)) throw new ShareError(`A link can last ${SHARE_LIMITS.minDays} to ${SHARE_LIMITS.maxDays} days.`);
  const sealed = new Set((await engineStatementStatus(householdId)).filter((s) => s.anchored).map((s) => s.period));
  const notSealed = unique.filter((m) => !sealed.has(m));
  if (notSealed.length) throw new ShareError(`Seal ${notSealed.join(", ")} on Proof check first, so they can be checked.`, 409);

  const link = await db.shareLink.create({
    data: {
      token: newPublicToken(),
      householdId,
      months: JSON.stringify(unique),
      label: label?.trim().slice(0, 80) || null,
      expiresAt: new Date(Date.now() + days * 86_400_000),
      createdById: userId,
    },
  });
  await db.auditLog.create({ data: { householdId, userId, action: "share.create", entity: "ShareLink", details: `${unique.join(",")} for ${days} days${link.label ? ` (${link.label})` : ""}` } });
  return { id: link.id, token: link.token, months: unique, expiresAt: link.expiresAt.toISOString(), label: link.label };
}

export async function listShares(householdId: string) {
  const rows = await db.shareLink.findMany({ where: { householdId }, orderBy: { createdAt: "desc" }, take: 50 });
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    label: r.label,
    months: parseMonths(r.months),
    expiresAt: r.expiresAt.toISOString(),
    views: r.views,
    lastViewAt: r.lastViewAt?.toISOString() ?? null,
    state: r.revokedAt ? "revoked" : r.expiresAt.getTime() < now ? "expired" : "active",
  }));
}

export async function revokeShare(householdId: string, id: string, userId: string) {
  const out = await db.shareLink.updateMany({ where: { id, householdId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (out.count === 0) throw new ShareError("Link not found", 404);
  await db.auditLog.create({ data: { householdId, userId, action: "share.revoke", entity: "ShareLink", details: id } });
}

/** What a verifier sees for a link (and the proof to check each month). Counts the view. */
export async function publicShare(token: string): Promise<PublicShare> {
  const link = await db.shareLink.findUnique({ where: { token } });
  if (!link) return { state: "not_found" };
  if (link.revokedAt) return { state: "revoked" };
  if (link.expiresAt.getTime() < Date.now()) return { state: "expired" };
  await db.shareLink.update({ where: { id: link.id }, data: { views: { increment: 1 }, lastViewAt: new Date() } });

  const identity = await ensureHouseholdIdentity(link.householdId);
  const household = await db.household.findUniqueOrThrow({ where: { id: link.householdId }, select: { city: true, state: true } });
  const status = await engineStatementStatus(link.householdId);
  const months: SharedMonth[] = [];
  for (const period of parseMonths(link.months)) {
    const st = status.find((s) => s.period === period && s.anchored);
    if (!st) continue;
    const b = await engineGetStatement(st.statement_id);
    if (b.statement?.household_ref !== link.householdId || b.batch_id == null) continue;
    const s = b.statement as Record<string, unknown>;
    months.push({
      period,
      totalKg: Number(s.total_kg),
      byCategory: (s.by_category as Record<string, number>) ?? {},
      verifiedReductionsKg: Number(s.verified_reductions_kg ?? 0),
      factorSet: String(s.factor_set ?? ""),
      issuedAt: String(s.issued_at ?? ""),
      anchor: b.anchor
        ? { chain: b.anchor.chain, txHash: b.anchor.tx_hash, explorerUrl: b.anchor.explorer_url ?? null, blockNumber: b.anchor.block_number ?? null, anchoredAt: b.anchor.anchored_at }
        : null,
      proof: { statement: b.statement, salt: b.salt, proof: b.proof, batch_id: b.batch_id },
    });
  }
  return { state: "ok", carbonId: identity.carbonId, city: household.city, region: household.state, expiresAt: link.expiresAt.toISOString(), months };
}

export { EngineError };
