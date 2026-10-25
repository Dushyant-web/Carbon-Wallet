-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN "commit_month" TEXT;
ALTER TABLE "recommendations" ADD COLUMN "expected_high" REAL;
ALTER TABLE "recommendations" ADD COLUMN "expected_low" REAL;
ALTER TABLE "recommendations" ADD COLUMN "realized_kg" REAL;
ALTER TABLE "recommendations" ADD COLUMN "verification" TEXT;
ALTER TABLE "recommendations" ADD COLUMN "verified_at" DATETIME;
ALTER TABLE "recommendations" ADD COLUMN "verify_note" TEXT;

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "week_start" DATETIME NOT NULL,
    "answers" TEXT NOT NULL,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "check_ins_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_goals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "target_pct" REAL NOT NULL,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "start_month" TEXT,
    "glide_months" INTEGER NOT NULL DEFAULT 6,
    "baseline_kg" REAL,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goals_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_goals" ("created_at", "deadline", "household_id", "id", "status", "target_pct") SELECT "created_at", "deadline", "household_id", "id", "status", "target_pct" FROM "goals";
DROP TABLE "goals";
ALTER TABLE "new_goals" RENAME TO "goals";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_household_id_week_start_key" ON "check_ins"("household_id", "week_start");

