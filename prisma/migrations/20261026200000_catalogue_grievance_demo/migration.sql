-- CreateTable
CREATE TABLE "catalogue_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_inr" INTEGER NOT NULL,
    "stars" INTEGER,
    "inverter" BOOLEAN NOT NULL DEFAULT false,
    "capacity_ton" REAL,
    "rated_power_w" INTEGER,
    "annual_kwh" REAL,
    "label_year" INTEGER,
    "refrigerant" TEXT,
    "fuel" TEXT,
    "km_per_unit" REAL,
    "battery_kwh" REAL,
    "model_year" INTEGER,
    "warranty_years" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "catalogue_items_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "catalogue_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "catalogue_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "catalogue_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grievances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticket" TEXT NOT NULL,
    "user_id" TEXT,
    "household_id" TEXT,
    "merchant_id" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "responded_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "resolved_at" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_merchant_sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchant_id" TEXT NOT NULL,
    "household_id" TEXT,
    "kind" TEXT NOT NULL,
    "appliance_id" TEXT,
    "vehicle_id" TEXT,
    "summary" TEXT NOT NULL,
    "invoice_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "catalogue_item_id" TEXT,
    "price_inr" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    CONSTRAINT "merchant_sales_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "merchant_sales_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "merchant_sales_appliance_id_fkey" FOREIGN KEY ("appliance_id") REFERENCES "appliances" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "merchant_sales_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "merchant_sales_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "catalogue_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_merchant_sales" ("appliance_id", "closed_at", "created_at", "household_id", "id", "invoice_ref", "kind", "merchant_id", "status", "summary", "vehicle_id") SELECT "appliance_id", "closed_at", "created_at", "household_id", "id", "invoice_ref", "kind", "merchant_id", "status", "summary", "vehicle_id" FROM "merchant_sales";
DROP TABLE "merchant_sales";
ALTER TABLE "new_merchant_sales" RENAME TO "merchant_sales";
CREATE UNIQUE INDEX "merchant_sales_appliance_id_key" ON "merchant_sales"("appliance_id");
CREATE UNIQUE INDEX "merchant_sales_vehicle_id_key" ON "merchant_sales"("vehicle_id");
CREATE INDEX "merchant_sales_merchant_id_created_at_idx" ON "merchant_sales"("merchant_id", "created_at");
CREATE INDEX "merchant_sales_household_id_idx" ON "merchant_sales"("household_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "catalogue_items_merchant_id_kind_idx" ON "catalogue_items"("merchant_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "catalogue_items_merchant_id_sku_key" ON "catalogue_items"("merchant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "catalogue_images_item_id_key" ON "catalogue_images"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "grievances_ticket_key" ON "grievances"("ticket");

-- CreateIndex
CREATE INDEX "grievances_user_id_idx" ON "grievances"("user_id");

-- CreateIndex
CREATE INDEX "grievances_status_created_at_idx" ON "grievances"("status", "created_at");

