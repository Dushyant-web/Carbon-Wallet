-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_challenges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "progress" REAL NOT NULL DEFAULT 0,
    "kg_saved" REAL NOT NULL,
    "inr_saved" REAL NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "days_done" INTEGER NOT NULL DEFAULT 0,
    "last_check_in" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "challenges_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_challenges" ("created_at", "household_id", "id", "inr_saved", "kg_saved", "progress", "status", "streak", "template") SELECT "created_at", "household_id", "id", "inr_saved", "kg_saved", "progress", "status", "streak", "template" FROM "challenges";
DROP TABLE "challenges";
ALTER TABLE "new_challenges" RENAME TO "challenges";
CREATE UNIQUE INDEX "challenges_household_id_template_key" ON "challenges"("household_id", "template");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

