-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lang" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "translations_lang_hash_key" ON "translations"("lang", "hash");
