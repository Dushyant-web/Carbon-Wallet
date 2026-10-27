-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_chain_leaves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "leaf_hash" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "proof" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "chain_leaves_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "chain_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_chain_leaves" ("batch_id", "id", "leaf_hash", "position", "ref_id", "type") SELECT "batch_id", "id", "leaf_hash", "position", "ref_id", "type" FROM "chain_leaves";
DROP TABLE "chain_leaves";
ALTER TABLE "new_chain_leaves" RENAME TO "chain_leaves";
CREATE INDEX "chain_leaves_batch_id_idx" ON "chain_leaves"("batch_id");
CREATE UNIQUE INDEX "chain_leaves_type_ref_id_key" ON "chain_leaves"("type", "ref_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

