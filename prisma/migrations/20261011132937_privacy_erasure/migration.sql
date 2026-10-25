-- AlterTable
ALTER TABLE "households" ADD COLUMN "deletion_requested_at" DATETIME;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "consent_at" DATETIME;
ALTER TABLE "users" ADD COLUMN "consent_version" TEXT;
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" DATETIME;

-- CreateTable
CREATE TABLE "erasure_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "users" INTEGER NOT NULL DEFAULT 0,
    "households" INTEGER NOT NULL DEFAULT 0,
    "statements" INTEGER NOT NULL DEFAULT 0,
    "files" INTEGER NOT NULL DEFAULT 0
);

