-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_monthly_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "total_kg" REAL NOT NULL,
    "by_category" TEXT NOT NULL,
    "by_gas" TEXT NOT NULL DEFAULT '{}',
    "score" REAL NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "monthly_summaries_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_monthly_summaries" ("by_category", "household_id", "id", "month", "score", "total_kg", "updated_at") SELECT "by_category", "household_id", "id", "month", "score", "total_kg", "updated_at" FROM "monthly_summaries";
DROP TABLE "monthly_summaries";
ALTER TABLE "new_monthly_summaries" RENAME TO "monthly_summaries";
CREATE INDEX "monthly_summaries_household_id_month_idx" ON "monthly_summaries"("household_id", "month");
CREATE UNIQUE INDEX "monthly_summaries_household_id_month_key" ON "monthly_summaries"("household_id", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
