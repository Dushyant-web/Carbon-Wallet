-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Carbon Card',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" DATETIME,
    CONSTRAINT "cards_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cards_uid_key" ON "cards"("uid");

-- CreateIndex
CREATE INDEX "cards_household_id_idx" ON "cards"("household_id");

