-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "months" TEXT NOT NULL,
    "label" TEXT,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "views" INTEGER NOT NULL DEFAULT 0,
    "last_view_at" DATETIME,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "share_links_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_household_id_idx" ON "share_links"("household_id");

