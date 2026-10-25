import { db } from "@/server/db";
import { ensureHouseholdIdentity } from "./identity.service";

export type PassbookStatus = "ANCHORED" | "RECORDED" | "OPEN";

export type PassbookMonth = {
  month: string; // YYYY-MM
  label: string; // "Mar 2026"
  totalKg: number;
  deltaPct: number | null;
  status: PassbookStatus;
  batchId: number | null;
  txHash: string | null;
};

/** What household members get: the passbook plus the private card code (never on the public page). */
export type MemberPassbook = Passbook & { cardCode: string };

export type Passbook = {
  carbonId: string;
  publicToken: string;
  household: { name: string; city: string; state: string; size: number; issuedOn: string };
  /** Latest complete month (the current calendar month is still filling up). */
  current: { month: string; label: string; totalKg: number; perPersonKg: number; trendPct: number; categories: Record<string, number> };
  inProgress: { month: string; label: string; totalKg: number } | null;
  months: PassbookMonth[];
  anchoredCount: number;
  engineReachable: boolean;
};

type EngineStatus = { period: string; anchored: boolean; batch_id: number | null; tx_hash: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

async function anchoringStatus(householdId: string): Promise<{ rows: EngineStatus[]; reachable: boolean }> {
  const base = process.env.PY_API_URL ?? "http://127.0.0.1:8001";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const res = await fetch(`${base}/api/v1/statements?household_ref=${encodeURIComponent(householdId)}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "x-engine-key": process.env.ENGINE_API_KEY ?? "" }, // the engine only answers this server
    });
    if (!res.ok) return { rows: [], reachable: false };
    return { rows: (await res.json()) as EngineStatus[], reachable: true };
  } catch {
    return { rows: [], reachable: false }; // engine offline: show months as recorded, never fail the page
  } finally {
    clearTimeout(timer);
  }
}

export async function buildPassbook(householdId: string): Promise<Passbook> {
  const identity = await ensureHouseholdIdentity(householdId);
  const household = await db.household.findUniqueOrThrow({
    where: { id: householdId },
    include: { monthlySummaries: { orderBy: { month: "desc" }, take: 6 } },
  });
  const { rows, reachable } = await anchoringStatus(householdId);
  const anchoredByMonth = new Map(rows.filter((r) => r.anchored).map((r) => [r.period, r]));

  const summaries = [...household.monthlySummaries].reverse(); // oldest → newest
  const nowKey = new Date().toISOString().slice(0, 7);
  const months: PassbookMonth[] = summaries.map((s, i) => {
    const prev = summaries[i - 1];
    const anchor = anchoredByMonth.get(s.month);
    const inProgress = s.month >= nowKey;
    return {
      month: s.month,
      label: monthLabel(s.month),
      totalKg: Math.round(s.totalKg * 10) / 10,
      // A part-month can't be compared with a full one.
      deltaPct: !inProgress && prev && prev.totalKg > 0 ? Math.round(((s.totalKg - prev.totalKg) / prev.totalKg) * 1000) / 10 : null,
      status: anchor ? "ANCHORED" : inProgress ? "OPEN" : "RECORDED",
      batchId: anchor?.batch_id ?? null,
      txHash: anchor?.tx_hash ?? null,
    };
  });

  const complete = summaries.filter((s) => s.month < nowKey);
  const latest = complete[complete.length - 1] ?? summaries[summaries.length - 1];
  const latestIdx = months.findIndex((m) => m.month === latest?.month);
  const open = summaries.find((s) => s.month >= nowKey);
  let categories: Record<string, number> = {};
  try {
    categories = latest ? JSON.parse(latest.byCategory) : {};
  } catch {
    categories = {};
  }
  const latestKg = latest?.totalKg ?? 0;

  return {
    carbonId: identity.carbonId,
    publicToken: identity.publicToken,
    household: {
      name: household.name,
      city: household.city,
      state: household.state,
      size: household.size,
      issuedOn: household.createdAt.toISOString(),
    },
    current: {
      month: latest?.month ?? nowKey,
      label: latest ? monthLabel(latest.month) : monthLabel(nowKey),
      totalKg: Math.round(latestKg * 10) / 10,
      perPersonKg: household.size ? Math.round(latestKg / household.size) : Math.round(latestKg),
      trendPct: months[latestIdx]?.deltaPct ?? 0,
      categories,
    },
    inProgress: open && open !== latest ? { month: open.month, label: monthLabel(open.month), totalKg: Math.round(open.totalKg * 10) / 10 } : null,
    months,
    anchoredCount: months.filter((m) => m.status === "ANCHORED").length,
    engineReachable: reachable,
  };
}

export async function householdIdForPublicToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  const hh = await db.household.findUnique({ where: { publicToken: token }, select: { id: true, status: true } });
  return hh && hh.status === "ACTIVE" ? hh.id : null;
}
