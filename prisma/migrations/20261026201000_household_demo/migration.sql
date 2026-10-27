-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_households" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "size" INTEGER NOT NULL,
    "home_type" TEXT NOT NULL,
    "floor_area_m2" REAL NOT NULL,
    "monthly_budget_inr" REAL,
    "join_code" TEXT NOT NULL,
    "carbon_id" TEXT,
    "public_token" TEXT,
    "card_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletion_requested_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owns_home" BOOLEAN,
    "demo" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_households" ("carbon_id", "card_code", "city", "country", "created_at", "deletion_requested_at", "floor_area_m2", "home_type", "id", "join_code", "monthly_budget_inr", "name", "owns_home", "public_token", "size", "state", "status") SELECT "carbon_id", "card_code", "city", "country", "created_at", "deletion_requested_at", "floor_area_m2", "home_type", "id", "join_code", "monthly_budget_inr", "name", "owns_home", "public_token", "size", "state", "status" FROM "households";
DROP TABLE "households";
ALTER TABLE "new_households" RENAME TO "households";
CREATE UNIQUE INDEX "households_join_code_key" ON "households"("join_code");
CREATE UNIQUE INDEX "households_carbon_id_key" ON "households"("carbon_id");
CREATE UNIQUE INDEX "households_public_token_key" ON "households"("public_token");
CREATE UNIQUE INDEX "households_card_code_key" ON "households"("card_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

