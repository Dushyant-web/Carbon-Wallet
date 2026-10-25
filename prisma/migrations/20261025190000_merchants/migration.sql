-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "gstin" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sells" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "merchant_scans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token_hash" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "items" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_scans_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "merchant_scans_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "merchant_sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchant_id" TEXT NOT NULL,
    "household_id" TEXT,
    "kind" TEXT NOT NULL,
    "appliance_id" TEXT,
    "vehicle_id" TEXT,
    "summary" TEXT NOT NULL,
    "invoice_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    CONSTRAINT "merchant_sales_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "merchant_sales_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "merchant_sales_appliance_id_fkey" FOREIGN KEY ("appliance_id") REFERENCES "appliances" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "merchant_sales_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_appliances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "power_kw" REAL NOT NULL,
    "avg_hours_per_day" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'OWNER',
    "brand" TEXT,
    "model" TEXT,
    "serial_no" TEXT,
    "purchased_on" DATETIME,
    "capacity_ton" REAL,
    "annual_kwh" REAL,
    "label_year" INTEGER,
    "refrigerant" TEXT,
    CONSTRAINT "appliances_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_appliances" ("avg_hours_per_day", "created_at", "household_id", "id", "name", "power_kw", "rating", "type") SELECT "avg_hours_per_day", "created_at", "household_id", "id", "name", "power_kw", "rating", "type" FROM "appliances";
DROP TABLE "appliances";
ALTER TABLE "new_appliances" RENAME TO "appliances";
CREATE UNIQUE INDEX "appliances_household_id_serial_no_key" ON "appliances"("household_id", "serial_no");
CREATE TABLE "new_vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "km_per_unit" REAL NOT NULL,
    "monthly_km" REAL NOT NULL,
    "year" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'OWNER',
    "make" TEXT,
    "model" TEXT,
    "vin" TEXT,
    "registration_no" TEXT,
    "purchased_on" DATETIME,
    CONSTRAINT "vehicles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vehicles" ("created_at", "fuel", "household_id", "id", "km_per_unit", "monthly_km", "name", "type", "year") SELECT "created_at", "fuel", "household_id", "id", "km_per_unit", "monthly_km", "name", "type", "year" FROM "vehicles";
DROP TABLE "vehicles";
ALTER TABLE "new_vehicles" RENAME TO "vehicles";
CREATE UNIQUE INDEX "vehicles_household_id_vin_key" ON "vehicles"("household_id", "vin");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "merchants_user_id_key" ON "merchants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_scans_token_hash_key" ON "merchant_scans"("token_hash");

-- CreateIndex
CREATE INDEX "merchant_scans_merchant_id_created_at_idx" ON "merchant_scans"("merchant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_sales_appliance_id_key" ON "merchant_sales"("appliance_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_sales_vehicle_id_key" ON "merchant_sales"("vehicle_id");

-- CreateIndex
CREATE INDEX "merchant_sales_merchant_id_created_at_idx" ON "merchant_sales"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "merchant_sales_household_id_idx" ON "merchant_sales"("household_id");

