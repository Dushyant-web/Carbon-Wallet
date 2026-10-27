import { z } from "zod";
import { db } from "@/server/db";
import { decrypt, encrypt } from "@/server/storage/encrypted";
import { cleanImage } from "@/server/storage/imageClean";
import { APPLIANCE_TYPES, RATINGS, labelOf } from "@/lib/assets";
import { closeSaleFor } from "./merchant.service";
import { refreshRecommendations } from "./recommendation.service";
import { notifyHousehold } from "./notify.service";

/*
 * Taking an item off a home. A household can't delete what a shop registered (or anything else): people would
 * quietly drop the big items. The owner asks instead, with photos and a two-line note; the item stays counted
 * until a platform admin approves. The same queue handles "Not ours" disputes against a shop.
 */

export const REMOVAL_REASONS = ["BROKEN", "SOLD", "GIVEN_AWAY", "SCRAPPED", "NEVER_HAD", "NOT_OURS"] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number];
/** Reasons where there's nothing to photograph */
const NO_PHOTO_NEEDED: RemovalReason[] = ["NEVER_HAD", "NOT_OURS"];
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const PHOTO_RETENTION_DAYS = 90;

export class RemovalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Reasons the owner can't really explain beyond the choice itself: the note is optional and filled in for them. */
export const NOTE_OPTIONAL: RemovalReason[] = ["NOT_OURS", "NEVER_HAD"];
const DEFAULT_NOTE: Partial<Record<RemovalReason, string>> = {
  NOT_OURS: "The shop registered this to our home by mistake. We did not buy it.",
  NEVER_HAD: "We never had this item.",
};

export const RemovalInput = z
  .object({
    kind: z.enum(["APPLIANCE", "VEHICLE"]),
    itemId: z.string().min(5).max(40),
    reason: z.enum(REMOVAL_REASONS),
    note: z.string().trim().max(240, "Keep it to about two lines (240 letters).").default(""),
  })
  .superRefine((v, ctx) => {
    if (!NOTE_OPTIONAL.includes(v.reason) && v.note.length < 10) ctx.addIssue({ code: "custom", path: ["note"], message: "Write what happened in a line or two." });
  })
  .transform((v) => ({ ...v, note: v.note || DEFAULT_NOTE[v.reason] || v.note }));

function applianceSummary(a: { name: string | null; type: string; rating: string; powerKw: number }) {
  return [a.name || labelOf(APPLIANCE_TYPES, a.type), labelOf(RATINGS, a.rating), `${a.powerKw} kW`].join(" · ");
}
function vehicleSummary(v: { name: string | null; type: string; fuel: string; year: number | null }) {
  return [v.name || v.type, v.fuel, v.year].filter(Boolean).join(" · ");
}

export async function createRemoval(householdId: string, userId: string, input: unknown, photos: Buffer[]) {
  const parsed = RemovalInput.safeParse(input);
  if (!parsed.success) throw new RemovalError(parsed.error.issues[0]?.message ?? "Check the form.", 400);
  const { kind, itemId, reason, note } = parsed.data;

  const item =
    kind === "APPLIANCE"
      ? await db.appliance.findFirst({ where: { id: itemId, householdId }, include: { sale: { include: { merchant: true } } } })
      : await db.vehicle.findFirst({ where: { id: itemId, householdId }, include: { sale: { include: { merchant: true } } } });
  if (!item) throw new RemovalError("That item isn't on this home.", 404);
  if (reason === "NOT_OURS" && !item.sale) throw new RemovalError("“Not ours” is only for items a shop registered.", 400);

  const pending = await db.removalRequest.findFirst({
    where: { householdId, status: "PENDING", ...(kind === "APPLIANCE" ? { applianceId: itemId } : { vehicleId: itemId }) },
  });
  if (pending) throw new RemovalError("A request for this item is already waiting for a decision.", 409);

  if (photos.length > MAX_PHOTOS) throw new RemovalError(`Up to ${MAX_PHOTOS} photos.`, 400);
  if (photos.length === 0 && !NO_PHOTO_NEEDED.includes(reason)) {
    throw new RemovalError("Add at least one photo: the item, its label, or the damage.", 400);
  }
  const clean = photos.map((p) => {
    if (p.length > MAX_PHOTO_BYTES) throw new RemovalError("Each photo must be under 3 MB.", 413);
    const c = cleanImage(p);
    if (!c) throw new RemovalError("Photos must be JPEG or PNG pictures.", 415);
    return c;
  });

  const summary = kind === "APPLIANCE" ? applianceSummary(item as Parameters<typeof applianceSummary>[0]) : vehicleSummary(item as Parameters<typeof vehicleSummary>[0]);
  const shopName = item.sale ? `${item.sale.merchant.businessName}, ${item.sale.merchant.city}` : null;

  const request = await db.$transaction(async (tx) => {
    const r = await tx.removalRequest.create({
      data: {
        householdId,
        kind,
        applianceId: kind === "APPLIANCE" ? itemId : null,
        vehicleId: kind === "VEHICLE" ? itemId : null,
        itemSummary: summary,
        shopName,
        reason,
        note,
        requestedById: userId,
      },
    });
    for (const c of clean) {
      await tx.removalPhoto.create({ data: { requestId: r.id, mimeType: c.mime, sizeBytes: c.data.length, data: new Uint8Array(encrypt(c.data)) } });
    }
    await tx.auditLog.create({
      data: { householdId, userId, action: "removal.requested", entity: kind === "APPLIANCE" ? "Appliance" : "Vehicle", details: `${summary}: ${reason.toLowerCase()}` },
    });
    return r;
  });
  return { id: request.id, status: request.status };
}

export async function listForHousehold(householdId: string) {
  const rows = await db.removalRequest.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { photos: { select: { id: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    itemId: r.applianceId ?? r.vehicleId,
    itemSummary: r.itemSummary,
    shopName: r.shopName,
    reason: r.reason,
    note: r.note,
    status: r.status,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    photoIds: r.photos.map((p) => p.id),
  }));
}

/** Admin queue: each request with the evidence an admin needs (photos, shop, bills before and after, other requests). */
export async function adminQueue(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
  const rows = await db.removalRequest.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 100,
    include: {
      photos: { select: { id: true } },
      household: {
        select: {
          id: true,
          name: true,
          city: true,
          carbonId: true,
          bills: { orderBy: { periodEnd: "desc" }, take: 4, select: { periodEnd: true, kwh: true } },
          _count: { select: { removalRequests: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    itemSummary: r.itemSummary,
    shopName: r.shopName,
    reason: r.reason,
    note: r.note,
    status: r.status,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    photoIds: r.photos.map((p) => p.id),
    household: {
      id: r.household.id,
      name: r.household.name,
      city: r.household.city,
      carbonId: r.household.carbonId,
      requestsEver: r.household._count.removalRequests,
      recentBills: r.household.bills.map((b) => ({ month: b.periodEnd.toISOString().slice(0, 7), kwh: b.kwh })).reverse(),
    },
  }));
}

const REASON_WORDS: Record<RemovalReason, string> = {
  BROKEN: "broken",
  SOLD: "sold",
  GIVEN_AWAY: "given away",
  SCRAPPED: "scrapped",
  NEVER_HAD: "never had it",
  NOT_OURS: "not ours",
};

export async function decideRemoval(requestId: string, adminId: string, approve: boolean, note: string | null) {
  const r = await db.removalRequest.findUnique({ where: { id: requestId } });
  if (!r) throw new RemovalError("Request not found", 404);
  if (r.status !== "PENDING") throw new RemovalError("This request was already decided.", 409);
  if (!approve && !note) throw new RemovalError("Tell the owner why, in a line.", 400);

  if (approve) {
    const itemId = r.applianceId ?? r.vehicleId;
    if (itemId) {
      const ref = r.kind === "APPLIANCE" ? { applianceId: itemId } : { vehicleId: itemId };
      await closeSaleFor(ref, r.householdId, adminId, r.reason === "NOT_OURS");
      if (r.kind === "APPLIANCE") await db.appliance.deleteMany({ where: { id: itemId, householdId: r.householdId } });
      else await db.vehicle.deleteMany({ where: { id: itemId, householdId: r.householdId } });
    }
  }
  const decided = await db.removalRequest.update({
    where: { id: r.id },
    data: { status: approve ? "APPROVED" : "REJECTED", decidedById: adminId, decisionNote: note, decidedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      householdId: r.householdId,
      userId: adminId,
      action: approve ? "removal.approved" : "removal.rejected",
      entity: r.kind === "APPLIANCE" ? "Appliance" : "Vehicle",
      details: `${r.itemSummary} (${REASON_WORDS[r.reason as RemovalReason] ?? r.reason})${note ? `: ${note}` : ""}`,
    },
  });
  if (approve) await refreshRecommendations(r.householdId);
  await notifyHousehold(
    r.householdId,
    {
      title: approve ? "Item removed from your home" : "Removal request not approved",
      body: approve ? `${r.itemSummary} is no longer counted.` : `${r.itemSummary} stays on your home. ${note ?? ""}`.trim(),
      url: "/assets",
      tag: `removal:${r.id}`,
    },
    ["OWNER"],
  );
  return { id: decided.id, status: decided.status };
}

/** A photo, decrypted, for the household's own members or an admin (checked by the caller). */
export async function photoFor(requestId: string, photoId: string) {
  const p = await db.removalPhoto.findFirst({ where: { id: photoId, requestId }, include: { request: { select: { householdId: true } } } });
  if (!p) return null;
  return { householdId: p.request.householdId, mime: p.mimeType, data: decrypt(Buffer.from(p.data)) };
}

/** Photos are kept 90 days after the decision, then deleted (scripts/purge.ts). */
export async function purgeOldPhotos(now = new Date()) {
  const cutoff = new Date(now.getTime() - PHOTO_RETENTION_DAYS * 86_400_000);
  const res = await db.removalPhoto.deleteMany({ where: { request: { status: { not: "PENDING" }, decidedAt: { lt: cutoff } } } });
  return res.count;
}
