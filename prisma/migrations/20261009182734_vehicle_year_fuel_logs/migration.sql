-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "year" INTEGER;

-- CreateTable
CREATE TABLE "fuel_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "amount_inr" REAL,
    "price_per_unit" REAL,
    "filled_on" DATETIME NOT NULL,
    "kg_co2e" REAL NOT NULL,
    "estimated_km" REAL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "activity_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fuel_logs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fuel_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "fuel_logs_activity_id_key" ON "fuel_logs"("activity_id");

-- CreateIndex
CREATE INDEX "fuel_logs_household_id_filled_on_idx" ON "fuel_logs"("household_id", "filled_on");

