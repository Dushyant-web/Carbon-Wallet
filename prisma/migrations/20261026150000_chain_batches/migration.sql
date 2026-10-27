-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "anchor_batches";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "anchor_leaves";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "chain_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "leaves" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tx_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "chain_leaves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "leaf_hash" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "chain_leaves_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "chain_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "chain_batches_day_key" ON "chain_batches"("day");

-- CreateIndex
CREATE INDEX "chain_leaves_batch_id_idx" ON "chain_leaves"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "chain_leaves_type_ref_id_key" ON "chain_leaves"("type", "ref_id");

