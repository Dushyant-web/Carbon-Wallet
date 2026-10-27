import { createHash } from "crypto";
import { db } from "@/server/db";
import { emissionService } from "./emission.service";
import { engineCalibrate, engineExtractBill } from "@/server/engine";
import { getEncrypted, putEncrypted, removeStored } from "@/server/storage/encrypted";
import { refreshRecommendations } from "./recommendation.service";
import type { BillDocumentView, BillExtraction, BillView, CalibrationView } from "@/lib/bills";

export class BillError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(message: string, status = 400, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
    this.name = "BillError";
  }
}

const MAX_BYTES = 10 * 1024 * 1024;
const DAY = 86_400_000;

function sniffMime(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const brand = bytes.subarray(4, 12).toString("latin1");
  if (["ftypheic", "ftypheix", "ftypmif1", "ftyphevc", "ftypmsf1"].includes(brand)) return "image/heic";
  return null;
}

const docDir = (householdId: string, docId: string) => ["bills", householdId, docId];

function toUtcDate(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new BillError(`Invalid date: ${iso}`);
  return d;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Splits [start, end) into calendar-month parts: kWh is shared by days, like a pro-rated bill. */
export function splitByMonth(start: Date, end: Date, kwh: number) {
  const total = Math.round((end.getTime() - start.getTime()) / DAY);
  const parts: { month: string; days: number; kwh: number; lastDay: Date }[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += DAY) {
    const d = new Date(t);
    const key = monthKey(d);
    const last = parts[parts.length - 1];
    if (last && last.month === key) {
      last.days += 1;
      last.lastDay = d;
    } else {
      parts.push({ month: key, days: 1, kwh: 0, lastDay: d });
    }
  }
  let assigned = 0;
  parts.forEach((p, i) => {
    p.kwh = i === parts.length - 1 ? Math.round((kwh - assigned) * 100) / 100 : Math.round(((kwh * p.days) / total) * 100) / 100;
    assigned += p.kwh;
  });
  return parts;
}

function publicExtraction(x: BillExtraction): BillDocumentView["extraction"] {
  const { previews: _p, consumer, ...rest } = x;
  void _p;
  return { ...rest, consumer: consumer ? { masked: consumer.masked } : null };
}

/** kWh the home drew from the grid: the import on a solar bill (when it's a sensible figure), else the units billed. */
export function gridKwh(b: { kwh: number; importKwh?: number | null }): number {
  return b.importKwh != null && b.importKwh >= b.kwh ? b.importKwh : b.kwh;
}

export const billService = {
  async upload(opts: { householdId: string; userId: string; fileName: string; bytes: Buffer; allowAi: boolean }) {
    const { householdId, userId, fileName, bytes, allowAi } = opts;
    if (bytes.length === 0) throw new BillError("The file is empty.");
    if (bytes.length > MAX_BYTES) throw new BillError("Bill files must be under 10 MB.", 413);
    const mime = sniffMime(bytes);
    if (!mime) throw new BillError("Upload a PDF, JPG, PNG or HEIC bill.", 415);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const existing = await db.document.findUnique({ where: { householdId_sha256: { householdId, sha256 } } });
    if (existing) throw new BillError("This exact file was already uploaded.", 409, { documentId: existing.id });

    const extraction = await engineExtractBill(bytes, allowAi);
    const previews = extraction.previews ?? [];
    const doc = await db.document.create({
      data: {
        householdId,
        uploadedById: userId,
        fileName: fileName.slice(0, 120) || "bill",
        mimeType: mime,
        sizeBytes: bytes.length,
        sha256,
        status: extraction.status === "ok" ? "EXTRACTED" : "NEEDS_REVIEW",
        extraction: JSON.stringify({ ...extraction, previews: undefined }),
        aiUsed: extraction.ai_used,
        previewCount: previews.length,
      },
    });
    const dir = docDir(householdId, doc.id);
    await putEncrypted([...dir, "original.bin"], bytes);
    await Promise.all(previews.map((b64, i) => putEncrypted([...dir, `preview-${i}.bin`], Buffer.from(b64, "base64"))));
    await db.document.update({ where: { id: doc.id }, data: { storagePath: dir.join("/") } });
    await db.auditLog.create({
      data: { householdId, userId, action: "bill.upload", entity: "Document", details: `Uploaded ${doc.fileName} (${extraction.discom.name})` },
    });
    return this.getDocument(householdId, doc.id);
  },

  /** Re-reads a stored upload with the AI fallback, after the user consents on the review screen. */
  async rereadWithAi(householdId: string, documentId: string, userId: string) {
    const doc = await db.document.findFirst({ where: { id: documentId, householdId } });
    if (!doc) throw new BillError("Document not found", 404);
    if (doc.status === "CONFIRMED") throw new BillError("This bill is already confirmed.", 409);
    if (!doc.storagePath) throw new BillError("The original file was deleted, so it can't be read again.", 410);
    const dir = docDir(householdId, doc.id);
    const extraction = await engineExtractBill(await getEncrypted([...dir, "original.bin"]), true);
    await db.document.update({
      where: { id: doc.id },
      data: {
        status: extraction.status === "ok" ? "EXTRACTED" : "NEEDS_REVIEW",
        extraction: JSON.stringify({ ...extraction, previews: undefined }),
        aiUsed: extraction.ai_used,
      },
    });
    await db.auditLog.create({
      data: { householdId, userId, action: "bill.ai_read", entity: "Document", details: `AI ${extraction.ai_used ? "used" : "unavailable"} for ${doc.fileName}` },
    });
    return this.getDocument(householdId, doc.id);
  },

  async getDocument(householdId: string, documentId: string): Promise<BillDocumentView> {
    const doc = await db.document.findFirst({ where: { id: documentId, householdId } });
    if (!doc) throw new BillError("Document not found", 404);
    return {
      id: doc.id,
      status: doc.status as BillDocumentView["status"],
      fileName: doc.fileName,
      previewCount: doc.previewCount,
      createdAt: doc.createdAt.toISOString(),
      extraction: publicExtraction(JSON.parse(doc.extraction) as BillExtraction),
    };
  },

  async getPreview(householdId: string, documentId: string, n: number): Promise<Buffer> {
    const doc = await db.document.findFirst({ where: { id: documentId, householdId } });
    if (!doc || !doc.storagePath || !Number.isInteger(n) || n < 0 || n >= doc.previewCount) throw new BillError("Preview not found", 404);
    return getEncrypted([...docDir(householdId, doc.id), `preview-${n}.bin`]);
  },

  async confirm(opts: {
    householdId: string;
    userId: string;
    documentId?: string | null;
    periodStart: string;
    periodEnd: string;
    kwh: number;
    amountInr?: number | null;
    importKwh?: number | null;
    exportKwh?: number | null;
    acHoursPerDay?: number;
    deleteOriginal?: boolean;
  }) {
    const { householdId, userId } = opts;
    // Same convention as the engine: [start, end) where end is the printed end / present-reading date,
    // so consecutive bills that share a reading date never overlap.
    const start = toUtcDate(opts.periodStart);
    const end = toUtcDate(opts.periodEnd);
    const days = Math.round((end.getTime() - start.getTime()) / DAY);
    if (days < 1 || days > 95) throw new BillError("A bill period should be between 1 and 95 days.");
    if (!(opts.kwh > 0 && opts.kwh <= 20000)) throw new BillError("Units must be between 0 and 20,000 kWh.");
    const ac = Math.min(24, Math.max(0, opts.acHoursPerDay ?? 0));

    const overlap = await db.bill.findFirst({
      where: { householdId, periodStart: { lt: end }, periodEnd: { gt: start } },
    });
    if (overlap) {
      throw new BillError("A bill already covers part of this period. Delete it first or check the dates.", 409, { billId: overlap.id });
    }

    let doc = null;
    let extraction: BillExtraction | null = null;
    if (opts.documentId) {
      doc = await db.document.findFirst({ where: { id: opts.documentId, householdId } });
      if (!doc) throw new BillError("Document not found", 404);
      if (doc.status === "CONFIRMED") throw new BillError("This bill is already confirmed.", 409);
      extraction = JSON.parse(doc.extraction) as BillExtraction;
    }

    const bill = await db.bill.create({
      data: {
        householdId,
        documentId: doc?.id ?? null,
        periodStart: start,
        periodEnd: end,
        kwh: opts.kwh,
        importKwh: opts.importKwh ?? null,
        exportKwh: opts.exportKwh ?? null,
        amountInr: opts.amountInr ?? null,
        acHoursPerDay: ac,
        discom: extraction?.discom.name ?? null,
        consumerHash: extraction?.consumer?.hash ?? null,
        consumerMasked: extraction?.consumer?.masked ?? null,
        source: doc ? "UPLOAD" : "MANUAL",
        confirmedById: userId,
      },
    });

    // 1. The kWh drawn from the grid, pro-rated into each calendar month it spans. On a solar (net-metering)
    //    bill that's the import, not the net units billed: exported solar is clean energy sent to the grid,
    //    shown on the bill but never subtracted from the home's own emissions (location-based method).
    const parts = splitByMonth(start, end, gridKwh(opts));
    for (const part of parts) {
      if (part.kwh <= 0) continue;
      const res = await emissionService.calculateAndRecord(householdId, {
        category: "Electricity",
        type: "grid_electricity",
        quantity: part.kwh,
        unit: "kWh",
        occurredOn: new Date(part.lastDay.getTime() + 12 * 3600_000),
        source: "BILL_IMPORT",
        notes: `Bill ${opts.periodStart} → ${opts.periodEnd} (${part.days} of ${days} days)`,
      });
      await db.activity.update({ where: { id: res.activity.id }, data: { billId: bill.id } });
    }

    // 2. Logged electricity inside the period is already in the bill: keep it visible, stop counting it
    await db.activity.updateMany({
      where: {
        householdId,
        category: "Electricity",
        billId: null,
        coveredByBillId: null,
        occurredOn: { gte: start, lt: end },
      },
      data: { coveredByBillId: bill.id },
    });
    for (const part of parts) await emissionService.recalculateMonthSummary(householdId, part.month);

    if (doc) {
      await db.document.update({ where: { id: doc.id }, data: { status: "CONFIRMED" } });
      if (opts.deleteOriginal !== false) {
        await removeStored(docDir(householdId, doc.id));
        await db.document.update({ where: { id: doc.id }, data: { storagePath: null, previewCount: 0 } });
      }
    }
    await db.auditLog.create({
      data: { householdId, userId, action: "bill.confirm", entity: "Bill", details: `${opts.kwh} kWh, ${opts.periodStart} → ${opts.periodEnd}` },
    });
    await this.recalibrate(householdId);
    await refreshRecommendations(householdId); // savings use the new AC kW, hours and tariff
    return bill;
  },

  async remove(householdId: string, billId: string, userId: string) {
    const bill = await db.bill.findFirst({ where: { id: billId, householdId } });
    if (!bill) throw new BillError("Bill not found", 404);
    const months = splitByMonth(bill.periodStart, bill.periodEnd, bill.kwh).map((p) => p.month);
    // Cascade deletes the bill's own activities (and their events); covered logs are released (SET NULL).
    await db.bill.delete({ where: { id: bill.id } });
    for (const m of months) await emissionService.recalculateMonthSummary(householdId, m);
    if (bill.documentId) {
      await db.document.update({ where: { id: bill.documentId }, data: { status: "EXTRACTED" } }).catch(() => null);
    }
    await db.auditLog.create({
      data: { householdId, userId, action: "bill.delete", entity: "Bill", details: `Removed ${bill.kwh} kWh bill` },
    });
    await this.recalibrate(householdId);
    await refreshRecommendations(householdId);
  },

  async removeDocument(householdId: string, documentId: string, userId: string, ownOnly = false) {
    const doc = await db.document.findFirst({ where: { id: documentId, householdId }, include: { bill: true } });
    if (!doc) throw new BillError("Document not found", 404);
    if (ownOnly && doc.uploadedById !== userId) throw new BillError("Only the owner can discard someone else's upload.", 403);
    if (doc.bill) throw new BillError("Delete the bill made from this document first.", 409);
    await removeStored(docDir(householdId, doc.id));
    await db.document.delete({ where: { id: doc.id } });
    await db.auditLog.create({ data: { householdId, userId, action: "document.delete", entity: "Document", details: doc.fileName } });
  },

  async list(householdId: string): Promise<{ bills: BillView[]; pending: BillDocumentView[]; calibration: CalibrationView | null }> {
    const [bills, pending, calibration] = await Promise.all([
      db.bill.findMany({
        where: { householdId },
        orderBy: { periodStart: "desc" },
        include: { activities: { include: { emissionEvents: { select: { kgCo2e: true } } } } },
      }),
      db.document.findMany({ where: { householdId, status: { in: ["EXTRACTED", "NEEDS_REVIEW"] } }, orderBy: { createdAt: "desc" } }),
      db.calibration.findFirst({ where: { householdId }, orderBy: { createdAt: "desc" } }),
    ]);
    return {
      bills: bills.map((b) => {
        const days = Math.round((b.periodEnd.getTime() - b.periodStart.getTime()) / DAY);
        return {
          id: b.id,
          periodStart: b.periodStart.toISOString().slice(0, 10),
          periodEnd: b.periodEnd.toISOString().slice(0, 10),
          days,
          kwh: b.kwh,
          importKwh: b.importKwh,
          exportKwh: b.exportKwh,
          amountInr: b.amountInr,
          acHoursPerDay: b.acHoursPerDay,
          discom: b.discom,
          consumerMasked: b.consumerMasked,
          source: b.source as BillView["source"],
          verified: b.verified,
          kgCo2e: Math.round(b.activities.flatMap((a) => a.emissionEvents).reduce((sum, e) => sum + e.kgCo2e, 0) * 10) / 10,
          documentId: b.documentId,
        };
      }),
      pending: pending.map((d) => ({
        id: d.id,
        status: d.status as BillDocumentView["status"],
        fileName: d.fileName,
        previewCount: d.previewCount,
        createdAt: d.createdAt.toISOString(),
        extraction: publicExtraction(JSON.parse(d.extraction) as BillExtraction),
      })),
      calibration: calibration
        ? {
            acKw: calibration.acKw,
            acKwLow: calibration.acKwLow,
            acKwHigh: calibration.acKwHigh,
            baseloadKwhDay: calibration.baseloadKwhDay,
            method: calibration.method,
            nBills: calibration.nBills,
            createdAt: calibration.createdAt.toISOString(),
          }
        : null,
    };
  },

  /** Fits AC kW + baseload from the household's real bills (engine regression). Best-effort. */
  async recalibrate(householdId: string) {
    const bills = await db.bill.findMany({ where: { householdId }, orderBy: { periodStart: "asc" } });
    if (bills.length === 0) {
      // nothing left to measure from: an old calibration would keep quoting bills that are gone
      await db.calibration.deleteMany({ where: { householdId } });
      return null;
    }
    try {
      const out = await engineCalibrate(
        bills.map((b) => {
          const days = Math.round((b.periodEnd.getTime() - b.periodStart.getTime()) / DAY);
          return {
            period_start: b.periodStart.toISOString().slice(0, 10),
            period_end: b.periodEnd.toISOString().slice(0, 10),
            kwh: gridKwh(b),
            ac_hours: b.acHoursPerDay * days,
          };
        }),
      );
      return db.calibration.create({
        data: {
          householdId,
          acKw: out.ac_kw,
          acKwLow: out.ac_kw_range[0],
          acKwHigh: out.ac_kw_range[1],
          baseloadKwhDay: out.baseload_kwh_per_day,
          method: out.method,
          nBills: out.n_bills,
        },
      });
    } catch {
      return null; // engine offline: totals are still correct; calibration refreshes on the next change
    }
  },
};
