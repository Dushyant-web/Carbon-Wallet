import { readFileSync, readdirSync } from "fs";
import path from "path";
import { db } from "@/server/db";
import { importCatalogue } from "@/server/services/catalogue.service";

/**
 * Demo catalogues for the two approved demo shops, from the same CSV + photo files a shop would upload
 * (prisma/seed/catalogue/). The pictures are simple drawings made for this project, not product photos.
 */
const DIR = path.join(__dirname, "catalogue");

export async function seedCatalogues() {
  const images = new Map<string, Buffer>();
  for (const f of readdirSync(DIR).filter((n) => /\.(png|jpe?g)$/i.test(n))) images.set(f.toLowerCase(), readFileSync(path.join(DIR, f)));
  for (const [shop, file] of [
    ["Demo Appliances", "demo-appliances.csv"],
    ["Demo Motors", "demo-motors.csv"],
  ] as const) {
    const merchant = await db.merchant.findFirst({ where: { businessName: shop } });
    if (!merchant) continue;
    const out = await importCatalogue(merchant, readFileSync(path.join(DIR, file), "utf8"), images);
    if (out.errors.length) console.warn(`catalogue ${shop}:`, out.errors);
    console.log(`🛒 ${shop}: ${out.created} added, ${out.updated} updated, ${out.imagesAttached} photos`);
  }
}

if (process.argv[1]?.endsWith("catalogue.ts")) {
  seedCatalogues()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
