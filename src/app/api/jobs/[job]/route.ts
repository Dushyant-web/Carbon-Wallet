import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/server/auth/session";
import { db } from "@/server/db";
import { runAreaJob } from "@/server/services/mohalla.service";
import { purgeDue } from "@/server/services/privacy.service";
import { purgeOldPhotos } from "@/server/services/removal.service";
import { runReminders } from "@/server/services/reminders.service";
import { istDay, sealDay } from "@/server/services/chain.service";
import { startForecastTraining } from "@/server/services/mlForecast.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled jobs for serverless hosting (.github/workflows/jobs.yml calls these): POST with
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set, every job is refused.
 *   areas      group homes into mohallas, recompute area totals (nightly)
 *   seal       anchor yesterday's events on chain (nightly, after areas)
 *   reminders  push reminders (hourly)
 *   purge      erase due accounts and old removal photos (daily)
 *   ml         retrain the next-month forecast model on the latest months (nightly, after areas)
 *   keepalive  one tiny query so a free Supabase project isn't paused (every few days)
 */
const JOBS: Record<string, () => Promise<unknown>> = {
  areas: () => runAreaJob(),
  seal: () => sealDay(istDay(new Date(Date.now() - 86_400_000))),
  reminders: () => runReminders(),
  purge: async () => ({ ...(await purgeDue()), photos: await purgeOldPhotos() }),
  ml: () => startForecastTraining(), // the engine trains in the background (~20 s); see /admin/ml
  keepalive: async () => ({ households: await db.household.count() }),
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!secret || !given || !safeEqual(given, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { job } = await params;
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  try {
    const out = await run();
    return NextResponse.json({ job, ok: true, result: out ?? null });
  } catch (err) {
    console.error(`[job:${job}]`, err);
    return NextResponse.json({ job, ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
