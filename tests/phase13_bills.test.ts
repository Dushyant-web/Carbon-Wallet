import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import type { BillExtraction } from "@/lib/bills";

// The OCR engine isn't running in tests: stand in for it with a fixed, realistic extraction.
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const field = <T,>(value: T, confidence: "high" | "medium" | "low" = "high") => ({
  value,
  confidence,
  score: 0.9,
  source: "pdf_text" as const,
  page: 0,
  bbox: [0.1, 0.2, 0.3, 0.25] as [number, number, number, number],
  snippet: String(value),
  reason: null,
  alternates: [],
});
const EXTRACTION: BillExtraction = {
  status: "ok",
  needs_ai: false,
  ai_used: false,
  file_kind: "pdf",
  text_source: "pdf_text",
  ocr_mean_conf: 0,
  discom: { id: "pvvnl", name: "PVVNL", state: "Uttar Pradesh", region: "IN-UP", cycle: "monthly" },
  fields: {
    units_kwh: field(590),
    amount_inr: field(4120.5),
    period_start: field("2026-01-01"),
    period_end: field("2026-03-01"),
    previous_reading: field(10000),
    present_reading: field(10590),
    multiplying_factor: field(1, "medium"),
    import_kwh: field(null, "low"),
    export_kwh: field(null, "low"),
    bill_date: field("2026-03-04"),
    due_date: field("2026-03-19"),
  },
  derived: { units_from_readings: 590, days: 59, inr_per_kwh: 6.98 },
  consumer: { masked: "••••4321", hash: "a".repeat(64) },
  warnings: [],
  pages: 1,
  previews: [PNG_1PX],
  elapsed_ms: 420,
};

vi.mock("@/server/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/engine")>();
  return {
    ...real,
    engineExtractBill: vi.fn(async () => structuredClone(EXTRACTION)),
    engineCalibrate: vi.fn(async (bills: unknown[]) => ({
      method: "regression",
      n_bills: bills.length,
      baseload_kwh_per_day: 6.1,
      ac_kw: 1.21,
      ac_kw_range: [1.03, 1.39],
      latest_bill: {},
      grid_factor: 0.675,
      factor_set: "IN-2026.1",
    })),
  };
});

const { splitByMonth } = await import("@/server/services/bill.service");
const { encrypt, decrypt, putEncrypted } = await import("@/server/storage/encrypted");
const { POST: upload } = await import("@/app/api/households/[id]/bills/upload/route");
const { GET: listBills, POST: confirmBill } = await import("@/app/api/households/[id]/bills/route");
const { DELETE: deleteBill } = await import("@/app/api/households/[id]/bills/[billId]/route");
const { GET: getDoc, DELETE: discardDoc } = await import("@/app/api/households/[id]/documents/[docId]/route");
const { GET: getPreview } = await import("@/app/api/households/[id]/documents/[docId]/preview/[n]/route");
const { resetRateLimits } = await import("@/server/auth/rateLimit");

const HH = "hh_03_verma";
const OTHER_HH = "hh_02_mehta";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n% fake bill for tests\n%%EOF\n");

function jsonReq(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function uploadReq(householdId: string, bytes: Buffer, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], "march-bill.pdf", { type: "application/pdf" }));
  return new NextRequest(`http://localhost:3000/api/households/${householdId}/bills/upload`, { method: "POST", body: form, headers });
}

const p = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) });

async function electricityKg(householdId: string, month: string) {
  const s = await db.monthlySummary.findUnique({ where: { householdId_month: { householdId, month } } });
  return s ? (JSON.parse(s.byCategory as unknown as string).Electricity as number) : 0;
}

describe("Phase 13: bill upload, review, booking and reversal", () => {
  let documentId = "";
  let billId = "";
  const before: Record<string, number> = {};

  beforeAll(async () => {
    resetRateLimits();
    before.jan = await electricityKg(HH, "2026-01");
    before.feb = await electricityKg(HH, "2026-02");
  });

  it("splits a bill across calendar months by days, keeping the exact total", () => {
    const parts = splitByMonth(new Date("2026-04-15T00:00:00Z"), new Date("2026-06-14T00:00:00Z"), 600);
    expect(parts.map((x) => [x.month, x.days])).toEqual([
      ["2026-04", 16],
      ["2026-05", 31],
      ["2026-06", 13],
    ]);
    expect(parts.reduce((s, x) => s + x.kwh, 0)).toBeCloseTo(600, 6);
    expect(parts[1].kwh).toBe(310);
  });

  it("encrypts stored files (AES-256-GCM) and rejects tampering and path tricks", async () => {
    const blob = encrypt(PDF);
    expect(blob.includes(Buffer.from("%PDF"))).toBe(false);
    expect(decrypt(blob).equals(PDF)).toBe(true);
    blob[blob.length - 1] ^= 1;
    expect(() => decrypt(blob)).toThrow();
    await expect(putEncrypted(["bills", "..", "escape"], PDF)).rejects.toThrow(/Unsafe/);
  });

  it("rejects viewers, non-bill files and other households' members", async () => {
    expect((await upload(uploadReq(HH, PDF, { "x-demo-role": "VIEWER" }), p({ id: HH }))).status).toBe(403);
    const notABill = await upload(uploadReq(HH, Buffer.from("just some text, not a bill")), p({ id: HH }));
    expect(notABill.status).toBe(415);
    const verma = await db.membership.findFirst({ where: { householdId: HH, role: "OWNER" } });
    const asOutsider = await upload(uploadReq(OTHER_HH, PDF, { "x-user-id": verma!.userId }), p({ id: OTHER_HH }));
    expect(asOutsider.status).toBe(403);
  });

  it("uploads a bill: stores it encrypted, returns the extraction without secrets, dedupes", async () => {
    const res = await upload(uploadReq(HH, PDF), p({ id: HH }));
    expect(res.status).toBe(201);
    const { document } = await res.json();
    documentId = document.id;
    expect(document.extraction.fields.units_kwh.value).toBe(590);
    expect(document.extraction.consumer).toEqual({ masked: "••••4321" }); // hash stays server-side
    expect(document.extraction.previews).toBeUndefined();
    expect(document.previewCount).toBe(1);

    const dir = path.join(process.env.STORAGE_DIR!, "bills", HH, documentId);
    expect((await readdir(dir)).sort()).toEqual(["original.bin", "preview-0.bin"]);
    const onDisk = await readFile(path.join(dir, "original.bin"));
    expect(onDisk.includes(Buffer.from("%PDF"))).toBe(false);

    const dup = await upload(uploadReq(HH, PDF), p({ id: HH }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).documentId).toBe(documentId);
  });

  it("serves the page preview only to the household", async () => {
    const ok = await getPreview(jsonReq(`/x`), p({ id: HH, docId: documentId, n: "0" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await ok.arrayBuffer()).equals(Buffer.from(PNG_1PX, "base64"))).toBe(true);
    expect((await getPreview(jsonReq(`/x`), p({ id: HH, docId: documentId, n: "7" }))).status).toBe(404);
    expect((await getPreview(jsonReq(`/x`), p({ id: HH, docId: documentId, n: "abc" }))).status).toBe(404);
    expect((await getDoc(jsonReq(`/x`), p({ id: OTHER_HH, docId: documentId }))).status).toBe(404);
  });

  it("confirms the bill: books it month by month and stops counting logs it covers", async () => {
    const coveredBefore = await db.activity.count({
      where: { householdId: HH, category: "Electricity", occurredOn: { gte: new Date("2026-01-01"), lt: new Date("2026-03-01") } },
    });
    expect(coveredBefore).toBeGreaterThan(0);

    const bad = await confirmBill(
      jsonReq(`/api/households/${HH}/bills`, { method: "POST", body: { documentId, periodStart: "2026-03-01", periodEnd: "2026-01-01", kwh: 590 } }),
      p({ id: HH }),
    );
    expect(bad.status).toBe(400);

    const res = await confirmBill(
      jsonReq(`/api/households/${HH}/bills`, {
        method: "POST",
        body: { documentId, periodStart: "2026-01-01", periodEnd: "2026-03-01", kwh: 590, amountInr: 4120.5, acHoursPerDay: 0 },
      }),
      p({ id: HH }),
    );
    expect(res.status).toBe(201);
    billId = (await res.json()).bill.id;

    const booked = await db.activity.findMany({ where: { billId }, orderBy: { occurredOn: "asc" } });
    expect(booked.map((a) => a.quantity)).toEqual([310, 280]); // 31 and 28 of 59 days
    expect(booked.every((a) => a.source === "BILL_IMPORT")).toBe(true);
    expect(await db.activity.count({ where: { coveredByBillId: billId } })).toBe(coveredBefore);

    // Electricity for each month is now exactly the bill's share at 0.675 kg/kWh
    expect(await electricityKg(HH, "2026-01")).toBeCloseTo(310 * 0.675, 1);
    expect(await electricityKg(HH, "2026-02")).toBeCloseTo(280 * 0.675, 1);

    const doc = await db.document.findUnique({ where: { id: documentId } });
    expect(doc!.status).toBe("CONFIRMED");
    expect(doc!.storagePath).toBeNull(); // original deleted after confirming (the default)
    await expect(readdir(path.join(process.env.STORAGE_DIR!, "bills", HH, documentId))).rejects.toThrow();

    const cal = await db.calibration.findFirst({ where: { householdId: HH }, orderBy: { createdAt: "desc" } });
    expect(cal?.acKw).toBe(1.21);
  });

  it("refuses a second bill over the same days, but allows the next period", async () => {
    const overlap = await confirmBill(
      jsonReq(`/api/households/${HH}/bills`, { method: "POST", body: { periodStart: "2026-02-15", periodEnd: "2026-03-15", kwh: 200 } }),
      p({ id: HH }),
    );
    expect(overlap.status).toBe(409);

    // The previous bill ends on this one's start (reading) date: no overlap
    const next = await confirmBill(
      jsonReq(`/api/households/${HH}/bills`, { method: "POST", body: { periodStart: "2025-12-02", periodEnd: "2026-01-01", kwh: 240 } }),
      p({ id: HH }),
    );
    expect(next.status).toBe(201);
    const nextId = (await next.json()).bill.id;
    expect((await db.bill.findUnique({ where: { id: nextId } }))!.source).toBe("MANUAL");
    expect((await deleteBill(jsonReq(`/x`, { method: "DELETE" }), p({ id: HH, billId: nextId }))).status).toBe(200);

    const list = await (await listBills(jsonReq(`/x`), p({ id: HH }))).json();
    expect(list.bills).toHaveLength(1);
    expect(list.bills[0]).toMatchObject({ days: 59, kwh: 590, source: "UPLOAD", discom: "PVVNL", consumerMasked: "••••4321" });
    expect(list.bills[0].kgCo2e).toBe(Math.round(590 * 0.675 * 10) / 10);
    expect(JSON.stringify(list)).not.toContain("a".repeat(64));
  });

  it("deleting the bill puts every number back", async () => {
    expect((await deleteBill(jsonReq(`/x`, { method: "DELETE", headers: { "x-demo-role": "VIEWER" } }), p({ id: HH, billId }))).status).toBe(403);
    const res = await deleteBill(jsonReq(`/x`, { method: "DELETE" }), p({ id: HH, billId }));
    expect(res.status).toBe(200);
    expect(await db.activity.count({ where: { billId } })).toBe(0);
    expect(await db.activity.count({ where: { coveredByBillId: billId } })).toBe(0);
    expect(await electricityKg(HH, "2026-01")).toBeCloseTo(before.jan, 1);
    expect(await electricityKg(HH, "2026-02")).toBeCloseTo(before.feb, 1);
    expect((await db.document.findUnique({ where: { id: documentId } }))!.status).toBe("EXTRACTED");
  });

  it("lets family add a bill, discard only their own upload, and never delete a confirmed bill", async () => {
    const family = await db.membership.findFirstOrThrow({ where: { householdId: HH, role: "MEMBER", status: "ACTIVE" } });
    const asFamily = { "x-user-id": family.userId };

    const mine = await upload(uploadReq(HH, Buffer.concat([PDF, Buffer.from("% family copy\n")]), asFamily), p({ id: HH }));
    expect(mine.status).toBe(201);
    const famDoc = (await mine.json()).document;
    // the owner's upload is not theirs to discard; their own is
    expect((await discardDoc(jsonReq(`/x`, { method: "DELETE", headers: asFamily }), p({ id: HH, docId: documentId }))).status).toBe(403);
    expect((await discardDoc(jsonReq(`/x`, { method: "DELETE", headers: asFamily }), p({ id: HH, docId: famDoc.id }))).status).toBe(200);

    const typed = await confirmBill(
      jsonReq(`/api/households/${HH}/bills`, { method: "POST", headers: asFamily, body: { periodStart: "2025-06-01", periodEnd: "2025-07-01", kwh: 300 } }),
      p({ id: HH }),
    );
    expect(typed.status).toBe(201);
    const typedId = (await typed.json()).bill.id;
    expect((await deleteBill(jsonReq(`/x`, { method: "DELETE", headers: asFamily }), p({ id: HH, billId: typedId }))).status).toBe(403);
    expect((await deleteBill(jsonReq(`/x`, { method: "DELETE" }), p({ id: HH, billId: typedId }))).status).toBe(200);
  });
});
