-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'ELECTRICITY_BILL',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_path" TEXT,
    "preview_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
    "extraction" TEXT NOT NULL,
    "ai_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "document_id" TEXT,
    "period_start" DATETIME NOT NULL,
    "period_end" DATETIME NOT NULL,
    "kwh" REAL NOT NULL,
    "import_kwh" REAL,
    "export_kwh" REAL,
    "amount_inr" REAL,
    "ac_hours_per_day" REAL NOT NULL DEFAULT 0,
    "discom" TEXT,
    "consumer_hash" TEXT,
    "consumer_masked" TEXT,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bills_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bills_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calibrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "ac_kw" REAL NOT NULL,
    "ac_kw_low" REAL NOT NULL,
    "ac_kw_high" REAL NOT NULL,
    "baseload_kwh_day" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "n_bills" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calibrations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "member_id" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "occurred_on" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "recurring_rule_id" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bill_id" TEXT,
    "covered_by_bill_id" TEXT,
    CONSTRAINT "activities_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activities_recurring_rule_id_fkey" FOREIGN KEY ("recurring_rule_id") REFERENCES "recurring_rules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activities_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activities_covered_by_bill_id_fkey" FOREIGN KEY ("covered_by_bill_id") REFERENCES "bills" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_activities" ("category", "created_at", "household_id", "id", "member_id", "notes", "occurred_on", "quantity", "recurring_rule_id", "source", "type", "unit") SELECT "category", "created_at", "household_id", "id", "member_id", "notes", "occurred_on", "quantity", "recurring_rule_id", "source", "type", "unit" FROM "activities";
DROP TABLE "activities";
ALTER TABLE "new_activities" RENAME TO "activities";
CREATE INDEX "activities_household_id_occurred_on_idx" ON "activities"("household_id", "occurred_on");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "documents_household_id_sha256_key" ON "documents"("household_id", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "bills_document_id_key" ON "bills"("document_id");

-- CreateIndex
CREATE INDEX "bills_household_id_period_start_idx" ON "bills"("household_id", "period_start");

-- CreateIndex
CREATE INDEX "calibrations_household_id_created_at_idx" ON "calibrations"("household_id", "created_at");

