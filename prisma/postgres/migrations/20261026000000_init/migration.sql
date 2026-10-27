-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "platform_role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notify_prefs" TEXT,
    "consent_version" TEXT,
    "consent_at" TIMESTAMP(3),
    "deletion_requested_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "size" INTEGER NOT NULL,
    "home_type" TEXT NOT NULL,
    "floor_area_m2" DOUBLE PRECISION NOT NULL,
    "monthly_budget_inr" DOUBLE PRECISION,
    "join_code" TEXT NOT NULL,
    "carbon_id" TEXT,
    "public_token" TEXT,
    "card_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletion_requested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owns_home" BOOLEAN,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_factors" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "kg_co2e_per_unit" DOUBLE PRECISION NOT NULL,
    "region" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "member_id" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "recurring_rule_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bill_id" TEXT,
    "covered_by_bill_id" TEXT,
    "covered_by_fuel_log_id" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_events" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "factor_id" TEXT NOT NULL,
    "kg_co2e" DOUBLE PRECISION NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_rules" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appliances" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "power_kw" DOUBLE PRECISION NOT NULL,
    "avg_hours_per_day" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'OWNER',
    "brand" TEXT,
    "model" TEXT,
    "serial_no" TEXT,
    "purchased_on" TIMESTAMP(3),
    "capacity_ton" DOUBLE PRECISION,
    "annual_kwh" DOUBLE PRECISION,
    "label_year" INTEGER,
    "refrigerant" TEXT,

    CONSTRAINT "appliances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "km_per_unit" DOUBLE PRECISION NOT NULL,
    "monthly_km" DOUBLE PRECISION NOT NULL,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'OWNER',
    "make" TEXT,
    "model" TEXT,
    "vin" TEXT,
    "registration_no" TEXT,
    "purchased_on" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_logs" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "amount_inr" DOUBLE PRECISION,
    "price_per_unit" DOUBLE PRECISION,
    "filled_on" TIMESTAMP(3) NOT NULL,
    "kg_co2e" DOUBLE PRECISION NOT NULL,
    "estimated_km" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "activity_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_summaries" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "total_kg" DOUBLE PRECISION NOT NULL,
    "by_category" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "kg_saved" DOUBLE PRECISION NOT NULL,
    "inr_saved" DOUBLE PRECISION NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "applied_at" TIMESTAMP(3),
    "commit_month" TEXT,
    "expected_low" DOUBLE PRECISION,
    "expected_high" DOUBLE PRECISION,
    "realized_kg" DOUBLE PRECISION,
    "verification" TEXT,
    "verified_at" TIMESTAMP(3),
    "verify_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kg_saved" DOUBLE PRECISION NOT NULL,
    "inr_saved" DOUBLE PRECISION NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "days_done" INTEGER NOT NULL DEFAULT 0,
    "last_check_in" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "target_pct" DOUBLE PRECISION NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "start_month" TEXT,
    "glide_months" INTEGER NOT NULL DEFAULT 6,
    "baseline_kg" DOUBLE PRECISION,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "carbon_cap_kg" DOUBLE PRECISION NOT NULL,
    "spend_cap_inr" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "details" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Carbon Card',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'ELECTRICITY_BILL',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_path" TEXT,
    "preview_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
    "extraction" TEXT NOT NULL,
    "ai_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "document_id" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "kwh" DOUBLE PRECISION NOT NULL,
    "import_kwh" DOUBLE PRECISION,
    "export_kwh" DOUBLE PRECISION,
    "amount_inr" DOUBLE PRECISION,
    "ac_hours_per_day" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heat_days" INTEGER,
    "heat_dates" TEXT,
    "discom" TEXT,
    "consumer_hash" TEXT,
    "consumer_masked" TEXT,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibrations" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "ac_kw" DOUBLE PRECISION NOT NULL,
    "ac_kw_low" DOUBLE PRECISION NOT NULL,
    "ac_kw_high" DOUBLE PRECISION NOT NULL,
    "baseload_kwh_day" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "n_bills" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "answers" TEXT NOT NULL,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "months" TEXT NOT NULL,
    "label" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "last_view_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sent_reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erasure_log" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "users" INTEGER NOT NULL DEFAULT 0,
    "households" INTEGER NOT NULL DEFAULT 0,
    "statements" INTEGER NOT NULL DEFAULT 0,
    "files" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "erasure_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "gstin" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sells" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_scans" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "items" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_sales" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "household_id" TEXT,
    "kind" TEXT NOT NULL,
    "appliance_id" TEXT,
    "vehicle_id" TEXT,
    "summary" TEXT NOT NULL,
    "invoice_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "catalogue_item_id" TEXT,
    "price_inr" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "merchant_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schemes" (
    "id" TEXT NOT NULL,
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
    "valid_until" TIMESTAMP(3),
    "last_checked" TIMESTAMP(3) NOT NULL,
    "source_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_help" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheme_help_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "removal_requests" (
    "id" TEXT NOT NULL,
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
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "removal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "removal_photos" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "removal_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_locations" (
    "household_id" TEXT NOT NULL,
    "h3_cell" TEXT NOT NULL,
    "h3_area" TEXT NOT NULL,
    "pincode" TEXT,
    "locality" TEXT,
    "district" TEXT,
    "state" TEXT,
    "source" TEXT NOT NULL,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "mohalla_id" TEXT,

    CONSTRAINT "household_locations_pkey" PRIMARY KEY ("household_id")
);

-- CreateTable
CREATE TABLE "mohallas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "h3_area" TEXT NOT NULL,
    "homes" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mohallas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_stats" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "homes" INTEGER NOT NULL,
    "people" INTEGER NOT NULL,
    "kg_per_person" DOUBLE PRECISION NOT NULL,
    "by_category" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_cells" (
    "h3_area" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weather_cells_pkey" PRIMARY KEY ("h3_area")
);

-- CreateTable
CREATE TABLE "chain_batches" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "leaves" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_leaves" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "leaf_hash" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "proof" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "chain_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue_items" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_inr" INTEGER NOT NULL,
    "stars" INTEGER,
    "inverter" BOOLEAN NOT NULL DEFAULT false,
    "capacity_ton" DOUBLE PRECISION,
    "rated_power_w" INTEGER,
    "annual_kwh" DOUBLE PRECISION,
    "label_year" INTEGER,
    "refrigerant" TEXT,
    "fuel" TEXT,
    "km_per_unit" DOUBLE PRECISION,
    "battery_kwh" DOUBLE PRECISION,
    "model_year" INTEGER,
    "warranty_years" INTEGER,
    "image_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue_images" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogue_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievances" (
    "id" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "user_id" TEXT,
    "household_id" TEXT,
    "merchant_id" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "responded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "grievances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "households_join_code_key" ON "households"("join_code");

-- CreateIndex
CREATE UNIQUE INDEX "households_carbon_id_key" ON "households"("carbon_id");

-- CreateIndex
CREATE UNIQUE INDEX "households_public_token_key" ON "households"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "households_card_code_key" ON "households"("card_code");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_household_id_user_id_key" ON "memberships"("household_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "emission_factors_category_type_region_key" ON "emission_factors"("category", "type", "region");

-- CreateIndex
CREATE INDEX "activities_household_id_occurred_on_idx" ON "activities"("household_id", "occurred_on");

-- CreateIndex
CREATE INDEX "emission_events_household_id_occurred_on_idx" ON "emission_events"("household_id", "occurred_on");

-- CreateIndex
CREATE UNIQUE INDEX "appliances_household_id_serial_no_key" ON "appliances"("household_id", "serial_no");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_household_id_vin_key" ON "vehicles"("household_id", "vin");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_logs_activity_id_key" ON "fuel_logs"("activity_id");

-- CreateIndex
CREATE INDEX "fuel_logs_household_id_filled_on_idx" ON "fuel_logs"("household_id", "filled_on");

-- CreateIndex
CREATE INDEX "monthly_summaries_household_id_month_idx" ON "monthly_summaries"("household_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_summaries_household_id_month_key" ON "monthly_summaries"("household_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_household_id_template_key" ON "challenges"("household_id", "template");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_household_id_month_key" ON "budgets"("household_id", "month");

-- CreateIndex
CREATE INDEX "audit_log_household_id_at_idx" ON "audit_log"("household_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_uid_key" ON "cards"("uid");

-- CreateIndex
CREATE INDEX "cards_household_id_idx" ON "cards"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_household_id_sha256_key" ON "documents"("household_id", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "bills_document_id_key" ON "bills"("document_id");

-- CreateIndex
CREATE INDEX "bills_household_id_period_start_idx" ON "bills"("household_id", "period_start");

-- CreateIndex
CREATE INDEX "calibrations_household_id_created_at_idx" ON "calibrations"("household_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_household_id_week_start_key" ON "check_ins"("household_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_household_id_idx" ON "share_links"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "sent_reminders_user_id_household_id_kind_period_key_key" ON "sent_reminders"("user_id", "household_id", "kind", "period_key");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_user_id_key" ON "merchants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_scans_token_hash_key" ON "merchant_scans"("token_hash");

-- CreateIndex
CREATE INDEX "merchant_scans_merchant_id_created_at_idx" ON "merchant_scans"("merchant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_sales_appliance_id_key" ON "merchant_sales"("appliance_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_sales_vehicle_id_key" ON "merchant_sales"("vehicle_id");

-- CreateIndex
CREATE INDEX "merchant_sales_merchant_id_created_at_idx" ON "merchant_sales"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "merchant_sales_household_id_idx" ON "merchant_sales"("household_id");

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
CREATE UNIQUE INDEX "chain_batches_day_key" ON "chain_batches"("day");

-- CreateIndex
CREATE INDEX "chain_leaves_batch_id_idx" ON "chain_leaves"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "chain_leaves_type_ref_id_key" ON "chain_leaves"("type", "ref_id");

-- CreateIndex
CREATE INDEX "catalogue_items_merchant_id_kind_idx" ON "catalogue_items"("merchant_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "catalogue_items_merchant_id_sku_key" ON "catalogue_items"("merchant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "catalogue_images_item_id_key" ON "catalogue_images"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "grievances_ticket_key" ON "grievances"("ticket");

-- CreateIndex
CREATE INDEX "grievances_user_id_idx" ON "grievances"("user_id");

-- CreateIndex
CREATE INDEX "grievances_status_created_at_idx" ON "grievances"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "translations_lang_hash_key" ON "translations"("lang", "hash");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_recurring_rule_id_fkey" FOREIGN KEY ("recurring_rule_id") REFERENCES "recurring_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_covered_by_bill_id_fkey" FOREIGN KEY ("covered_by_bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_covered_by_fuel_log_id_fkey" FOREIGN KEY ("covered_by_fuel_log_id") REFERENCES "fuel_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_events" ADD CONSTRAINT "emission_events_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_events" ADD CONSTRAINT "emission_events_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_events" ADD CONSTRAINT "emission_events_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "emission_factors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appliances" ADD CONSTRAINT "appliances_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_summaries" ADD CONSTRAINT "monthly_summaries_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_scans" ADD CONSTRAINT "merchant_scans_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_scans" ADD CONSTRAINT "merchant_scans_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_sales" ADD CONSTRAINT "merchant_sales_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_sales" ADD CONSTRAINT "merchant_sales_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_sales" ADD CONSTRAINT "merchant_sales_appliance_id_fkey" FOREIGN KEY ("appliance_id") REFERENCES "appliances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_sales" ADD CONSTRAINT "merchant_sales_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_sales" ADD CONSTRAINT "merchant_sales_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "catalogue_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_help" ADD CONSTRAINT "scheme_help_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_help" ADD CONSTRAINT "scheme_help_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_help" ADD CONSTRAINT "scheme_help_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_appliance_id_fkey" FOREIGN KEY ("appliance_id") REFERENCES "appliances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_photos" ADD CONSTRAINT "removal_photos_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "removal_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_locations" ADD CONSTRAINT "household_locations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_locations" ADD CONSTRAINT "household_locations_mohalla_id_fkey" FOREIGN KEY ("mohalla_id") REFERENCES "mohallas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chain_leaves" ADD CONSTRAINT "chain_leaves_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "chain_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue_items" ADD CONSTRAINT "catalogue_items_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue_images" ADD CONSTRAINT "catalogue_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "catalogue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

