import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { leavesForDay, sealDay, sealOf } from "@/server/services/chain.service";
import { POST as runJob } from "@/app/api/jobs/[job]/route";

/*
 * Blockchain v2 without a chain: the engine's /events/anchor is stubbed, so this checks what the website keeps
 * (one batch a day, every leaf with its proof, nothing readable in a leaf) and the cron-only job endpoint.
 */
const DAY = "2031-01-02"; // a day no other test writes to
const at = new Date(`${DAY}T10:00:00+05:30`);
let posted: { day: string; leaves: string[] } | null = null;

describe("Phase 29: daily chain seal and scheduled jobs", () => {
  beforeAll(async () => {
    await db.areaStat.createMany({
      data: [
        { level: "INDIA", key: "IN", month: "2030-12", homes: 25, people: 90, kgPerPerson: 51.2, byCategory: "{}", computedAt: at },
        { level: "STATE", key: "UP", month: "2030-12", homes: 21, people: 80, kgPerPerson: 47.9, byCategory: "{}", computedAt: at },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
        expect(String(url)).toContain("/api/v1/events/anchor");
        expect(init.headers["x-engine-sig"]).toMatch(/^[0-9a-f]{64}$/); // signed, never the bare key
        expect(init.headers["x-engine-key"]).toBeUndefined();
        posted = JSON.parse(init.body);
        const n = posted!.leaves.length;
        return new Response(JSON.stringify({ root: `0x${"ab".repeat(32)}`, proofs: Array.from({ length: n }, (_, i) => [`0x${String(i).padStart(64, "0")}`]), tx_hash: `0x${"cd".repeat(32)}`, chain: "local-devnet" }), { status: 201 });
      }),
    );
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.anchorBatch.deleteMany({ where: { day: DAY } });
    await db.areaStat.deleteMany({ where: { month: "2030-12" } });
  });

  it("seals a day once, keeps every leaf's proof, and sends only hashes", async () => {
    const leaves = await leavesForDay(DAY);
    expect(leaves).toHaveLength(2);
    const batch = await sealDay(DAY);
    expect(batch).toMatchObject({ day: DAY, leaves: 2, status: "ANCHORED" });
    expect(posted!.leaves.every((h) => /^0x[0-9a-f]{64}$/.test(h))).toBe(true);
    expect(JSON.stringify(posted)).not.toMatch(/UP|INDIA|47\.9/);

    const again = await sealDay(DAY);
    expect(again!.id).toBe(batch!.id);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    const seal = await sealOf(leaves[0].type, leaves[0].refId);
    expect(seal).toMatchObject({ day: DAY, root: `0x${"ab".repeat(32)}`, leaf: leaves[0].hash });
    expect(seal!.proof).toHaveLength(1);
    expect(await sealDay("2031-01-03")).toBeNull(); // nothing happened that day
  });

  it("runs scheduled jobs only with the cron secret", async () => {
    const call = (job: string, auth?: string) =>
      runJob(new NextRequest(`http://localhost:3000/api/jobs/${job}`, { method: "POST", headers: auth ? { authorization: auth } : {} }), { params: Promise.resolve({ job }) });
    expect((await call("keepalive")).status).toBe(401); // no CRON_SECRET configured at all
    vi.stubEnv("CRON_SECRET", "s3cret-for-tests");
    expect((await call("keepalive", "Bearer wrong")).status).toBe(401);
    expect((await call("nope", "Bearer s3cret-for-tests")).status).toBe(404);
    const ok = await call("keepalive", "Bearer s3cret-for-tests");
    expect(ok.status).toBe(200);
    expect((await ok.json()).result.households).toBeGreaterThan(0);
    vi.unstubAllEnvs();
  });
});
