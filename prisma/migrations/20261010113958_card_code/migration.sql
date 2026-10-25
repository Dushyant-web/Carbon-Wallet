-- AlterTable
ALTER TABLE "households" ADD COLUMN "card_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "households_card_code_key" ON "households"("card_code");

