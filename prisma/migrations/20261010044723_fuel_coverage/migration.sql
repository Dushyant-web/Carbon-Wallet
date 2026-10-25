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
    "covered_by_fuel_log_id" TEXT,
    CONSTRAINT "activities_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activities_recurring_rule_id_fkey" FOREIGN KEY ("recurring_rule_id") REFERENCES "recurring_rules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activities_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activities_covered_by_bill_id_fkey" FOREIGN KEY ("covered_by_bill_id") REFERENCES "bills" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activities_covered_by_fuel_log_id_fkey" FOREIGN KEY ("covered_by_fuel_log_id") REFERENCES "fuel_logs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_activities" ("bill_id", "category", "covered_by_bill_id", "created_at", "household_id", "id", "member_id", "notes", "occurred_on", "quantity", "recurring_rule_id", "source", "type", "unit") SELECT "bill_id", "category", "covered_by_bill_id", "created_at", "household_id", "id", "member_id", "notes", "occurred_on", "quantity", "recurring_rule_id", "source", "type", "unit" FROM "activities";
DROP TABLE "activities";
ALTER TABLE "new_activities" RENAME TO "activities";
CREATE INDEX "activities_household_id_occurred_on_idx" ON "activities"("household_id", "occurred_on");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

