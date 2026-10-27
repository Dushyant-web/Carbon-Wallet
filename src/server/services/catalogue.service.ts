import type { Merchant } from "@prisma/client";
import { db } from "@/server/db";
import { cleanImage } from "@/server/storage/imageClean";
import { removeProductImage, saveProductImage } from "@/server/storage/publicImages";
import { CatalogueRowSchema, catalogueFacts, csvRecords } from "@/lib/catalogue";
import { sellsAppliances, sellsVehicles } from "@/lib/merchant";

/*
 * A shop's catalogue: imported from a CSV (+ photos), listed on the shop's dashboard, picked at the counter.
 * Rows are upserted by the shop's own SKU, so re-uploading the same sheet updates prices instead of duplicating.
 */

export const MAX_ROWS = 1000;
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES = 200;

export class CatalogueError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type ImportResult = {
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
  imagesAttached: number;
  imagesMissing: string[];
  imagesRejected: string[];
};

export async function importCatalogue(merchant: Merchant, csv: string, images: Map<string, Buffer>): Promise<ImportResult> {
  const records = csvRecords(csv);
  if (!records.length) throw new CatalogueError("The CSV has no rows. Download the template to see the columns.");
  if (records.length > MAX_ROWS) throw new CatalogueError(`Up to ${MAX_ROWS} products per upload.`);
  const out: ImportResult = { created: 0, updated: 0, errors: [], imagesAttached: 0, imagesMissing: [], imagesRejected: [] };
  const seen = new Set<string>();

  for (const { line, record } of records) {
    const parsed = CatalogueRowSchema.safeParse(record);
    if (!parsed.success) {
      out.errors.push({ line, message: parsed.error.issues.map((i) => i.message).join("; ") });
      continue;
    }
    const r = parsed.data;
    if (seen.has(r.sku)) {
      out.errors.push({ line, message: `sku ${r.sku} appears twice in this file` });
      continue;
    }
    seen.add(r.sku);
    if (r.kind === "APPLIANCE" && !sellsAppliances(merchant.sells)) {
      out.errors.push({ line, message: "skipped: an appliance row, but your shop is registered to sell vehicles only" });
      continue;
    }
    if (r.kind === "VEHICLE" && !sellsVehicles(merchant.sells)) {
      out.errors.push({ line, message: "skipped: a vehicle row, but your shop is registered to sell appliances only" });
      continue;
    }
    const data = {
      kind: r.kind,
      type: r.type,
      brand: r.brand,
      model: r.model,
      title: r.title || `${r.brand} ${r.model}`,
      description: r.description,
      priceInr: r.price_inr,
      stars: r.stars,
      inverter: r.inverter,
      capacityTon: r.capacity_ton,
      ratedPowerW: r.rated_power_w,
      annualKwh: r.annual_kwh,
      labelYear: r.label_year,
      refrigerant: r.refrigerant,
      fuel: r.fuel,
      kmPerUnit: r.km_per_unit,
      batteryKwh: r.battery_kwh,
      modelYear: r.model_year,
      warrantyYears: r.warranty_years,
      active: true,
    };
    const existing = await db.catalogueItem.findUnique({ where: { merchantId_sku: { merchantId: merchant.id, sku: r.sku } }, select: { id: true } });
    const item = existing
      ? await db.catalogueItem.update({ where: { id: existing.id }, data })
      : await db.catalogueItem.create({ data: { merchantId: merchant.id, sku: r.sku, ...data } });
    if (existing) out.updated++;
    else out.created++;

    if (r.image) {
      const bytes = images.get(r.image.toLowerCase());
      if (!bytes) {
        out.imagesMissing.push(r.image);
      } else {
        const clean = bytes.length <= MAX_IMAGE_BYTES ? cleanImage(bytes) : null;
        if (!clean) out.imagesRejected.push(r.image);
        else {
          await saveProductImage(item.id, clean);
          out.imagesAttached++;
        }
      }
    }
  }
  return out;
}

type ItemRow = Awaited<ReturnType<typeof db.catalogueItem.findMany>>[number] & { image?: { id: string } | null; _count?: { sales: number } };

export function publicItem(i: ItemRow) {
  return {
    id: i.id,
    sku: i.sku,
    kind: i.kind,
    type: i.type,
    brand: i.brand,
    model: i.model,
    title: i.title,
    description: i.description,
    priceInr: i.priceInr,
    stars: i.stars,
    inverter: i.inverter,
    capacityTon: i.capacityTon,
    ratedPowerW: i.ratedPowerW,
    annualKwh: i.annualKwh,
    labelYear: i.labelYear,
    refrigerant: i.refrigerant,
    fuel: i.fuel,
    kmPerUnit: i.kmPerUnit,
    batteryKwh: i.batteryKwh,
    modelYear: i.modelYear,
    warrantyYears: i.warrantyYears,
    active: i.active,
    imageUrl: i.imageUrl ?? (i.image ? `/api/catalogue/images/${i.id}` : null),
    sold: i._count?.sales ?? 0,
    facts: catalogueFacts(i),
  };
}

export async function listCatalogue(merchantId: string, onlyActive = false) {
  const rows = await db.catalogueItem.findMany({
    where: { merchantId, ...(onlyActive ? { active: true } : {}) },
    orderBy: [{ kind: "asc" }, { type: "asc" }, { priceInr: "asc" }],
    include: { image: { select: { id: true } }, _count: { select: { sales: true } } },
  });
  return rows.map(publicItem);
}

export async function setItemActive(merchantId: string, id: string, active: boolean) {
  const res = await db.catalogueItem.updateMany({ where: { id, merchantId }, data: { active } });
  if (!res.count) throw new CatalogueError("Product not found", 404);
}

/**
 * Deletes the product for good, with its photo. Past sales keep their own copy of the item summary and price
 * (their link to the product is set to null), so the shop's history and the homes' items are unaffected.
 */
export async function deleteItem(merchantId: string, id: string) {
  const item = await db.catalogueItem.findFirst({ where: { id, merchantId }, select: { id: true, _count: { select: { sales: true } } } });
  if (!item) throw new CatalogueError("Product not found", 404);
  await removeProductImage(item.id);
  await db.catalogueItem.delete({ where: { id } });
  return { sold: item._count.sales };
}

export async function catalogueImage(itemId: string) {
  return db.catalogueImage.findUnique({ where: { itemId }, select: { mimeType: true, data: true } });
}

/** The shop's dashboard: what it sold, how efficient, the help it gave with schemes, and how homes responded. */
export async function merchantDashboard(merchant: Merchant) {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1));
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [sales, help, catalogue, scans] = await Promise.all([
    db.merchantSale.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        summary: true,
        status: true,
        createdAt: true,
        priceInr: true,
        householdId: true,
        household: { select: { carbonId: true } },
        appliance: { select: { rating: true } },
        vehicle: { select: { fuel: true } },
        catalogueItem: { select: { id: true, title: true } },
      },
    }),
    db.schemeHelp.findMany({ where: { merchantId: merchant.id }, select: { status: true, scheme: { select: { name: true } } } }),
    db.catalogueItem.count({ where: { merchantId: merchant.id, active: true } }),
    db.merchantScan.count({ where: { merchantId: merchant.id, createdAt: { gte: monthStart } } }),
  ]);
  const efficient = (s: (typeof sales)[number]) =>
    (s.appliance && /5_STAR|INVERTER/.test(s.appliance.rating) && s.appliance.rating !== "NON_INVERTER") || s.vehicle?.fuel === "Electric";
  const kept = sales.filter((s) => s.status !== "REJECTED");
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  const byMonth = months.map((m) => {
    const inMonth = kept.filter((s) => s.createdAt.toISOString().slice(0, 7) === m);
    return { month: m, items: inMonth.length, efficient: inMonth.filter(efficient).length };
  });
  const products = new Map<string, { title: string; sold: number }>();
  for (const s of kept) if (s.catalogueItem) products.set(s.catalogueItem.id, { title: s.catalogueItem.title, sold: (products.get(s.catalogueItem.id)?.sold ?? 0) + 1 });
  return {
    shop: { name: merchant.businessName, city: merchant.city, sells: merchant.sells },
    kpis: {
      itemsThisMonth: kept.filter((s) => s.createdAt >= monthStart).length,
      itemsTotal: kept.length,
      customers: new Set(kept.map((s) => s.householdId).filter(Boolean)).size,
      scansThisMonth: scans,
      efficientPct: kept.length ? Math.round((kept.filter(efficient).length / kept.length) * 100) : 0,
      rejected: sales.filter((s) => s.status === "REJECTED").length,
      schemesExplained: help.length,
      schemesApplied: help.filter((h) => h.status === "APPLIED").length,
      catalogueItems: catalogue,
      revenueInr: kept.reduce((a, s) => a + (s.priceInr ?? 0), 0),
    },
    byMonth,
    topProducts: [...products.values()].sort((a, b) => b.sold - a.sold).slice(0, 5),
    recent: sales.slice(0, 8).map((s) => ({ id: s.id, summary: s.summary, status: s.status, at: s.createdAt.toISOString(), carbonId: s.household?.carbonId ?? null })),
  };
}

/** One product's photo, added or replaced from the catalogue page. */
export async function setItemPhoto(merchantId: string, id: string, bytes: Buffer) {
  const item = await db.catalogueItem.findFirst({ where: { id, merchantId }, select: { id: true } });
  if (!item) throw new CatalogueError("Product not found", 404);
  if (bytes.length > MAX_IMAGE_BYTES) throw new CatalogueError("Photos must be under 2 MB.", 413);
  const clean = cleanImage(bytes);
  if (!clean) throw new CatalogueError("That isn't a JPEG or PNG photo.", 415);
  return saveProductImage(item.id, clean);
}

export async function clearItemPhoto(merchantId: string, id: string) {
  const item = await db.catalogueItem.findFirst({ where: { id, merchantId }, select: { id: true } });
  if (!item) throw new CatalogueError("Product not found", 404);
  await removeProductImage(item.id);
}
