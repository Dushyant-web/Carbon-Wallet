import { createHash, randomBytes } from "crypto";
import { Prisma, type Merchant } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { parseReaderInput, resolveReaderInput } from "./card.service";
import { refreshRecommendations } from "./recommendation.service";
import { sendToUser } from "./notify.service";
import { counterAdvice, recordCounterHelp } from "./scheme.service";
import {
  APPLIANCE_TYPES,
  DEFAULT_HOURS,
  MerchantApplianceSchema,
  MerchantSaleSchema,
  MerchantVehicleSchema,
  labelOf,
  ratingFrom,
  suggestedMileage,
} from "@/lib/assets";
import { sellsAppliances, sellsVehicles } from "@/lib/merchant";

/*
 * Registering a purchase at a shop counter. The customer shows their Carbon Card, the shop scans it, then
 * registers what was bought onto that household:
 *
 *   scanCard      card code (barcode / chip text) or a paired chip serial → a 15-minute ticket for that house.
 *                 Public /p/ links are refused: people share those openly, the card itself stays in their wallet.
 *   registerSale  ticket + item → an Appliance or Vehicle marked source MERCHANT, a MerchantSale for the shop's
 *                 history, an audit row in the household's log, and a push to the owner, who can say "Not ours".
 *
 * The shop only ever sees the Carbon ID, the household's name and city: never members, numbers or the card code.
 */

export const SCAN_MINUTES = 15;
export const ITEMS_PER_SCAN = 10;
const MAX_HOURS = 24;

export class MerchantError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "MerchantError";
  }
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const NOT_RECOGNISED = "Card not recognised. Scan the barcode on the back of the Carbon Card, tap its chip, or type the code under the barcode.";

export type ScanResult = {
  ticket: string;
  expiresAt: string;
  customer: { carbonId: string | null; name: string; city: string; state: string };
  /** a colour and one sentence (never numbers), and the government benefits that fit what this shop sells */
  advice: Awaited<ReturnType<typeof counterAdvice>>;
};

export async function scanCard(merchant: Merchant, userId: string, input: string): Promise<ScanResult> {
  if (parseReaderInput(input).kind === "token") {
    throw new MerchantError("That's a shared link, not the card. Scan the barcode on the back of the card instead.", 422);
  }
  const hit = await resolveReaderInput(input);
  if (!hit || hit.via !== "card") throw new MerchantError(NOT_RECOGNISED, 404);
  const household = await db.household.findUnique({
    where: { id: hit.householdId },
    select: { id: true, name: true, city: true, state: true, carbonId: true, status: true },
  });
  if (!household || household.status !== "ACTIVE") throw new MerchantError(NOT_RECOGNISED, 404);

  const ticket = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SCAN_MINUTES * 60_000);
  await db.merchantScan.create({
    data: { tokenHash: sha256(ticket), merchantId: merchant.id, householdId: household.id, via: hit.cardId ? "CHIP" : "CODE", expiresAt },
  });
  await db.auditLog.create({
    data: {
      householdId: household.id,
      userId,
      action: "merchant.scan",
      entity: "Merchant",
      details: `${merchant.businessName}, ${merchant.city} scanned the card`,
    },
  });
  return {
    ticket,
    expiresAt: expiresAt.toISOString(),
    customer: { carbonId: household.carbonId, name: household.name, city: household.city, state: household.state },
    advice: await counterAdvice(household.id, merchant.sells),
  };
}

/** The scan behind a ticket, if it belongs to this shop and is still open. */
async function liveScan(merchant: Merchant, ticket: string) {
  const scan = await db.merchantScan.findUnique({ where: { tokenHash: sha256(ticket) } });
  if (!scan) throw new MerchantError("Scan the customer's card again.", 404);
  if (scan.merchantId !== merchant.id) throw new MerchantError("This scan belongs to another shop.", 403);
  if (scan.expiresAt.getTime() < Date.now()) throw new MerchantError("This scan has expired. Scan the customer's card again.", 410);
  return scan;
}

const HelpSchema = z.object({ ticket: z.string().min(10).max(100), slug: z.string().min(2).max(60), status: z.enum(["EXPLAINED", "APPLIED"]) });

/** The shop explained a scheme to the customer, or helped them apply. The household is told, with the official link. */
export async function recordSchemeHelp(merchant: Merchant, userId: string, body: unknown) {
  const parsed = HelpSchema.safeParse(body);
  if (!parsed.success) throw new MerchantError("Pick a scheme.", 400);
  const scan = await liveScan(merchant, parsed.data.ticket);
  const shop = `${merchant.businessName}, ${merchant.city}`;
  try {
    await recordCounterHelp(scan.householdId, merchant.id, shop, parsed.data.slug, parsed.data.status);
  } catch (err) {
    throw new MerchantError(err instanceof Error ? err.message : "Scheme not found", 404);
  }
  await db.auditLog.create({
    data: { householdId: scan.householdId, userId, action: "merchant.scheme_help", entity: "Scheme", details: `${parsed.data.slug} ${parsed.data.status.toLowerCase()} by ${shop}` },
  });
  return { ok: true };
}

type ApplianceIn = z.infer<typeof MerchantApplianceSchema>;
type VehicleIn = z.infer<typeof MerchantVehicleSchema>;

function applianceSummary(a: ApplianceIn) {
  const spec = [a.capacityTon ? `${a.capacityTon} t` : null, a.stars ? `${a.stars}-star` : null, a.inverter ? "inverter" : null]
    .filter(Boolean)
    .join(" ");
  return `${spec ? `${spec} ` : ""}${labelOf(APPLIANCE_TYPES, a.type).toLowerCase()} · ${a.brand} ${a.model}`;
}

const vehicleName = (v: VehicleIn) => [v.make, v.model, v.variant].filter(Boolean).join(" ");
const vehicleSummary = (v: VehicleIn) => `${vehicleName(v)} (${v.fuel.toLowerCase()}, ${v.year})`;

/** Starting hours a day: from the label's yearly energy when the shop has it, else typical for the type. */
function startingHours(a: ApplianceIn) {
  const kw = a.ratedPowerW / 1000;
  if (a.annualKwh && a.type !== "AC" && a.type !== "SolarPV") {
    return Math.min(MAX_HOURS, Math.round((a.annualKwh / 365 / kw) * 10) / 10);
  }
  return DEFAULT_HOURS[a.type] ?? 4;
}

/**
 * A product picked from the shop's catalogue: its label facts come from the catalogue (exact BEE figures), and
 * only what's unique to this unit (serial / chassis number, invoice, date) comes from the counter form.
 */
async function withCatalogue(merchant: Merchant, body: unknown): Promise<{ body: unknown; itemId: string | null; price: number | null }> {
  const b = body as { catalogueItemId?: unknown; ticket?: unknown; item?: Record<string, unknown> } | null;
  if (!b || typeof b.catalogueItemId !== "string") return { body, itemId: null, price: null };
  const c = await db.catalogueItem.findFirst({ where: { id: b.catalogueItemId, merchantId: merchant.id, active: true } });
  if (!c) throw new MerchantError("That product isn't in your catalogue any more.", 404);
  const own = b.item ?? {};
  const unit = (keys: string[]) => Object.fromEntries(keys.filter((k) => own[k] !== undefined).map((k) => [k, own[k]]));
  const item =
    c.kind === "APPLIANCE"
      ? {
          type: c.type,
          brand: c.brand,
          model: c.model,
          stars: c.stars ?? 0,
          inverter: c.inverter,
          labelYear: c.labelYear,
          ratedPowerW: c.ratedPowerW ?? 0,
          capacityTon: c.capacityTon,
          annualKwh: c.annualKwh,
          refrigerant: c.refrigerant,
          ...unit(["serialNo", "invoiceRef", "purchasedOn"]),
        }
      : {
          type: c.type,
          fuel: c.fuel,
          make: c.brand,
          model: c.model,
          year: c.modelYear,
          kmPerUnit: c.kmPerUnit,
          ...unit(["variant", "vin", "registrationNo", "invoiceRef", "purchasedOn"]),
        };
  return { body: { kind: c.kind, ticket: b.ticket, item }, itemId: c.id, price: c.priceInr };
}

export async function registerSale(merchant: Merchant, userId: string, rawBody: unknown) {
  const picked = await withCatalogue(merchant, rawBody);
  const parsed = MerchantSaleSchema.safeParse(picked.body);
  if (!parsed.success) throw new MerchantError(parsed.error.issues[0]?.message ?? "Check the item's details.", 400);
  const sale = parsed.data;

  const scan = await liveScan(merchant, sale.ticket);
  if (scan.items >= ITEMS_PER_SCAN) throw new MerchantError(`Up to ${ITEMS_PER_SCAN} items per scan. Scan the card again to add more.`, 409);
  if (sale.kind === "APPLIANCE" && !sellsAppliances(merchant.sells)) throw new MerchantError("Your shop is registered for vehicles only.", 403);
  if (sale.kind === "VEHICLE" && !sellsVehicles(merchant.sells)) throw new MerchantError("Your shop is registered for appliances only.", 403);

  const household = await db.household.findUnique({ where: { id: scan.householdId }, select: { id: true, name: true, status: true } });
  if (!household || household.status !== "ACTIVE") throw new MerchantError(NOT_RECOGNISED, 404);
  const householdId = household.id;
  const shop = `${merchant.businessName}, ${merchant.city}`;
  const purchasedOn = sale.item.purchasedOn ?? new Date();

  let result: { saleId: string; summary: string; kind: "APPLIANCE" | "VEHICLE"; itemId: string; name: string };
  try {
    result = await db.$transaction(async (tx) => {
      // the ticket's item count is checked again inside the transaction, so two tills can't both go over it
      const claimed = await tx.merchantScan.updateMany({
        where: { id: scan.id, items: { lt: ITEMS_PER_SCAN } },
        data: { items: { increment: 1 } },
      });
      if (claimed.count === 0) throw new MerchantError("Scan the card again to add more items.", 409);

      if (sale.kind === "APPLIANCE") {
        const a = sale.item;
        const name = `${a.brand} ${a.model}`.slice(0, 60);
        const appliance = await tx.appliance.create({
          data: {
            householdId,
            name,
            type: a.type,
            rating: ratingFrom(a.stars, a.inverter, a.type),
            powerKw: Math.round((a.ratedPowerW / 1000) * 1000) / 1000,
            avgHoursPerDay: startingHours(a),
            source: "MERCHANT",
            brand: a.brand,
            model: a.model,
            serialNo: a.serialNo,
            purchasedOn,
            capacityTon: a.capacityTon ?? null,
            annualKwh: a.annualKwh ?? null,
            labelYear: a.labelYear ?? null,
            refrigerant: a.refrigerant ?? null,
          },
        });
        const summary = applianceSummary(a);
        const row = await tx.merchantSale.create({
          data: { merchantId: merchant.id, householdId, kind: "APPLIANCE", applianceId: appliance.id, summary, invoiceRef: a.invoiceRef || null, catalogueItemId: picked.itemId, priceInr: picked.price },
        });
        return { saleId: row.id, summary, kind: "APPLIANCE" as const, itemId: appliance.id, name };
      }

      const v = sale.item;
      const name = vehicleName(v).slice(0, 60);
      const vehicle = await tx.vehicle.create({
        data: {
          householdId,
          name,
          type: v.type,
          fuel: v.fuel,
          year: v.year,
          kmPerUnit: v.kmPerUnit ?? suggestedMileage(v.type, v.fuel, v.year),
          monthlyKm: 600, // the household sets its own
          source: "MERCHANT",
          make: v.make,
          model: v.model,
          vin: v.vin,
          registrationNo: v.registrationNo || null,
          purchasedOn,
        },
      });
      const summary = vehicleSummary(v);
      const row = await tx.merchantSale.create({
        data: { merchantId: merchant.id, householdId, kind: "VEHICLE", vehicleId: vehicle.id, summary, invoiceRef: v.invoiceRef || null, catalogueItemId: picked.itemId, priceInr: picked.price },
      });
      return { saleId: row.id, summary, kind: "VEHICLE" as const, itemId: vehicle.id, name };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new MerchantError(
        sale.kind === "APPLIANCE" ? "This serial number is already registered to this home." : "This chassis number is already registered to this home.",
        409,
      );
    }
    throw err;
  }

  await db.auditLog.create({
    data: { householdId, userId, action: "merchant.register", entity: result.kind === "APPLIANCE" ? "Appliance" : "Vehicle", details: `${result.summary}, by ${shop}` },
  });
  await refreshRecommendations(householdId);
  await notifyOwners(householdId, household.name, shop, result.summary, result.saleId);

  return { sale: { id: result.saleId, kind: result.kind, summary: result.summary, createdAt: new Date().toISOString() }, item: { id: result.itemId, name: result.name } };
}

/** The owner hears about every registration at once, so a wrong one can be turned down quickly. */
async function notifyOwners(householdId: string, householdName: string, shop: string, summary: string, saleId: string) {
  const owners = await db.membership.findMany({ where: { householdId, role: "OWNER", status: "ACTIVE" }, select: { userId: true } });
  for (const o of owners) {
    await sendToUser(o.userId, {
      title: "New item registered to your home",
      body: `${shop} added a ${summary} to ${householdName}. Not yours? Open Card & items.`,
      url: "/assets",
      tag: `merchant:${saleId}`,
    }).catch(() => 0); // a failed push never undoes the sale
  }
}

/** The shop's own history: what it registered and whether the owner kept it. Never the household's internals. */
export async function listSales(merchantId: string, limit = 100) {
  const rows = await db.merchantSale.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { household: { select: { carbonId: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    summary: r.summary,
    invoiceRef: r.invoiceRef,
    status: r.status,
    carbonId: r.household?.carbonId ?? null, // null once the household has been erased
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
  }));
}

/**
 * The owner removed an item a shop registered: "not ours" (a rejection admins see against the shop) or simply
 * sold / scrapped. Runs before the item itself is deleted.
 */
export async function closeSaleFor(
  item: { applianceId?: string; vehicleId?: string },
  householdId: string,
  userId: string,
  notOurs: boolean,
) {
  const sale = await db.merchantSale.findFirst({
    where: { householdId, ...(item.applianceId ? { applianceId: item.applianceId } : { vehicleId: item.vehicleId }) },
    include: { merchant: { select: { businessName: true, city: true } } },
  });
  if (!sale) return null;
  await db.merchantSale.update({ where: { id: sale.id }, data: { status: notOurs ? "REJECTED" : "REMOVED", closedAt: new Date() } });
  await db.auditLog.create({
    data: {
      householdId,
      userId,
      action: notOurs ? "merchant.sale.rejected" : "merchant.sale.removed",
      entity: sale.kind === "APPLIANCE" ? "Appliance" : "Vehicle",
      details: `${sale.summary}, registered by ${sale.merchant.businessName}, ${sale.merchant.city}`,
    },
  });
  return sale;
}

/** Shop name and date for items a shop registered, keyed by item id (for the household's own lists). */
export async function registeredBy(householdId: string) {
  const sales = await db.merchantSale.findMany({
    where: { householdId, status: "REGISTERED" },
    select: {
      applianceId: true,
      vehicleId: true,
      createdAt: true,
      priceInr: true,
      merchant: { select: { businessName: true, city: true } },
      catalogueItem: { select: { id: true, title: true, imageUrl: true, image: { select: { id: true } } } },
    },
  });
  const map = new Map<string, { shop: string; city: string; at: string; product: string | null; imageUrl: string | null; priceInr: number | null }>();
  for (const s of sales) {
    const id = s.applianceId ?? s.vehicleId;
    if (id) {
      map.set(id, {
        shop: s.merchant.businessName,
        city: s.merchant.city,
        at: s.createdAt.toISOString(),
        product: s.catalogueItem?.title ?? null,
        imageUrl: s.catalogueItem?.imageUrl ?? (s.catalogueItem?.image ? `/api/catalogue/images/${s.catalogueItem.id}` : null),
        priceInr: s.priceInr,
      });
    }
  }
  return map;
}
