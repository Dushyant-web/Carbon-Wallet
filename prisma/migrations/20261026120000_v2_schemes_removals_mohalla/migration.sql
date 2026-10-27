-- AlterTable
ALTER TABLE "households" ADD COLUMN "owns_home" BOOLEAN;

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schemes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_hi" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "summary_hi" TEXT NOT NULL,
    "benefit" TEXT NOT NULL,
    "benefit_hi" TEXT NOT NULL,
    "who_qualifies" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "documents" TEXT,
    "link" TEXT NOT NULL,
    "helpline" TEXT,
    "states" TEXT NOT NULL DEFAULT 'ALL',
    "discoms" TEXT,
    "valid_until" DATETIME,
    "last_checked" DATETIME NOT NULL,
    "source_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "scheme_help" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scheme_help_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "scheme_help_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "schemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "scheme_help_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "removal_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "household_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "appliance_id" TEXT,
    "vehicle_id" TEXT,
    "item_summary" TEXT NOT NULL,
    "shop_name" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decision_note" TEXT,
    "decided_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "removal_requests_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "removal_requests_appliance_id_fkey" FOREIGN KEY ("appliance_id") REFERENCES "appliances" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "removal_requests_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "removal_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "request_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "removal_photos_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "removal_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "household_locations" (
    "household_id" TEXT NOT NULL PRIMARY KEY,
    "h3_cell" TEXT NOT NULL,
    "h3_area" TEXT NOT NULL,
    "pincode" TEXT,
    "locality" TEXT,
    "district" TEXT,
    "state" TEXT,
    "source" TEXT NOT NULL,
    "consent_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "mohalla_id" TEXT,
    CONSTRAINT "household_locations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "household_locations_mohalla_id_fkey" FOREIGN KEY ("mohalla_id") REFERENCES "mohallas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mohallas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "h3_area" TEXT NOT NULL,
    "homes" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "area_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "homes" INTEGER NOT NULL,
    "people" INTEGER NOT NULL,
    "kg_per_person" REAL NOT NULL,
    "by_category" TEXT NOT NULL,
    "computed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "weather_cells" (
    "h3_area" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "fetched_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "anchor_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "leaves" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tx_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "anchor_leaves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "leaf_hash" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "anchor_leaves_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "anchor_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_identities_provider_subject_key" ON "oauth_identities"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "schemes_slug_key" ON "schemes"("slug");

-- CreateIndex
CREATE INDEX "scheme_help_household_id_idx" ON "scheme_help"("household_id");

-- CreateIndex
CREATE INDEX "removal_requests_status_created_at_idx" ON "removal_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "removal_requests_household_id_idx" ON "removal_requests"("household_id");

-- CreateIndex
CREATE INDEX "removal_photos_request_id_idx" ON "removal_photos"("request_id");

-- CreateIndex
CREATE INDEX "household_locations_h3_area_idx" ON "household_locations"("h3_area");

-- CreateIndex
CREATE INDEX "household_locations_mohalla_id_idx" ON "household_locations"("mohalla_id");

-- CreateIndex
CREATE UNIQUE INDEX "mohallas_code_key" ON "mohallas"("code");

-- CreateIndex
CREATE UNIQUE INDEX "area_stats_level_key_month_key" ON "area_stats"("level", "key", "month");

-- CreateIndex
CREATE UNIQUE INDEX "anchor_batches_day_key" ON "anchor_batches"("day");

-- CreateIndex
CREATE INDEX "anchor_leaves_batch_id_idx" ON "anchor_leaves"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "anchor_leaves_type_ref_id_key" ON "anchor_leaves"("type", "ref_id");

