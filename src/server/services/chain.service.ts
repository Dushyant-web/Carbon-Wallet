import { createHash } from "crypto";
import { db } from "@/server/db";
import { engineHeaders } from "@/server/engineAuth";

/*
 * Blockchain v2 (PLAN-V2 §13): once a day, every platform event of that day becomes one leaf, and the engine
 * anchors their Merkle root on chain. A leaf is the SHA-256 of the event's own fields (with its random id), so the
 * chain holds nothing readable: no names, places, photos or numbers. Kept here: each leaf, its proof and the
 * transaction, so anyone holding an event's details can later show it was recorded that day and not changed.
 *
 *   SALE         a shop registered an item          SCHEME_HELP  a shop explained a scheme / helped apply
 *   REMOVAL      an admin approved or rejected       AREA         a mohalla / city / state / India monthly total
 */

const BASE = () => process.env.PY_API_URL ?? "http://127.0.0.1:8001";
type Leaf = { type: "SALE" | "REMOVAL" | "SCHEME_HELP" | "AREA"; refId: string; hash: string };

const sha = (o: unknown) => `0x${createHash("sha256").update(JSON.stringify(o)).digest("hex")}`;

/** IST calendar day → UTC bounds */
function dayBounds(day: string) {
  const start = new Date(`${day}T00:00:00+05:30`);
  return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
}

export function istDay(d = new Date()) {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export async function leavesForDay(day: string): Promise<Leaf[]> {
  const when = dayBounds(day);
  const [sales, removals, help, areas] = await Promise.all([
    db.merchantSale.findMany({ where: { createdAt: when }, orderBy: { id: "asc" } }),
    db.removalRequest.findMany({ where: { decidedAt: when }, orderBy: { id: "asc" } }),
    db.schemeHelp.findMany({ where: { createdAt: when }, orderBy: { id: "asc" } }),
    db.areaStat.findMany({ where: { computedAt: when }, orderBy: { id: "asc" } }),
  ]);
  return [
    ...sales.map((s) => ({ type: "SALE" as const, refId: s.id, hash: sha({ t: "SALE", id: s.id, m: s.merchantId, h: s.householdId, k: s.kind, s: s.summary, at: s.createdAt.toISOString() }) })),
    ...removals.map((r) => ({ type: "REMOVAL" as const, refId: r.id, hash: sha({ t: "REMOVAL", id: r.id, h: r.householdId, r: r.reason, st: r.status, i: r.itemSummary, at: r.decidedAt!.toISOString() }) })),
    ...help.map((x) => ({ type: "SCHEME_HELP" as const, refId: x.id, hash: sha({ t: "SCHEME_HELP", id: x.id, h: x.householdId, s: x.schemeId, m: x.merchantId, st: x.status, at: x.createdAt.toISOString() }) })),
    ...areas.map((a) => ({ type: "AREA" as const, refId: `${a.id}@${a.computedAt.toISOString()}`, hash: sha({ t: "AREA", l: a.level, k: a.key, mo: a.month, n: a.homes, kg: a.kgPerPerson, at: a.computedAt.toISOString() }) })),
  ];
}

/** Seals one IST day. Safe to call again: a day is sealed once. Returns null when nothing happened that day. */
export async function sealDay(day: string) {
  const existing = await db.anchorBatch.findUnique({ where: { day } });
  if (existing) return existing;
  const all = await leavesForDay(day);
  // an event already sealed on another day (e.g. a recomputed area total) keeps its first seal
  const sealed = new Set((await db.anchorLeaf.findMany({ where: { refId: { in: all.map((l) => l.refId) } }, select: { type: true, refId: true } })).map((l) => `${l.type}:${l.refId}`));
  const leaves = all.filter((l) => !sealed.has(`${l.type}:${l.refId}`));
  if (!leaves.length) return null;

  const url = `${BASE()}/api/v1/events/anchor`;
  const body = JSON.stringify({ day, leaves: leaves.map((l) => l.hash) });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...engineHeaders("POST", url, body) },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000), // the nightly job retries tomorrow rather than hitting the 30 s function limit
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof out.detail === "string" ? out.detail : `anchoring failed (${res.status})`);

  return db.anchorBatch.create({
    data: {
      day,
      root: out.root,
      leaves: leaves.length,
      status: "ANCHORED",
      txHash: out.tx_hash,
      entries: {
        create: leaves.map((l, i) => ({ type: l.type, refId: l.refId, leafHash: l.hash, position: i, proof: JSON.stringify(out.proofs[i] ?? []) })),
      },
    },
  });
}

/** Where an event was sealed, with what's needed to check it against the chain. */
export async function sealOf(type: Leaf["type"], refId: string) {
  const leaf = await db.anchorLeaf.findUnique({ where: { type_refId: { type, refId } }, include: { batch: true } });
  if (!leaf) return null;
  return { day: leaf.batch.day, root: leaf.batch.root, txHash: leaf.batch.txHash, leaf: leaf.leafHash, proof: JSON.parse(leaf.proof) as string[] };
}
