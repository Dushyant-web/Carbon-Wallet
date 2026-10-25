-- AlterTable
ALTER TABLE "households" ADD COLUMN "carbon_id" TEXT;
ALTER TABLE "households" ADD COLUMN "public_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "households_carbon_id_key" ON "households"("carbon_id");

-- CreateIndex
CREATE UNIQUE INDEX "households_public_token_key" ON "households"("public_token");

