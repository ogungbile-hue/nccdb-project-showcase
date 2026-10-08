/*
  Warnings:

  - The values [SCRAPER,WHATSAPP] on the enum `PriceSourceType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[resetToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PriceSourceType_new" AS ENUM ('QS_REPORT', 'MANUAL_ENTRY', 'TENDER_RETURN', 'MARKET_BULLETIN');
ALTER TABLE "price_records" ALTER COLUMN "sourceType" TYPE "PriceSourceType_new" USING ("sourceType"::text::"PriceSourceType_new");
ALTER TYPE "PriceSourceType" RENAME TO "PriceSourceType_old";
ALTER TYPE "PriceSourceType_new" RENAME TO "PriceSourceType";
DROP TYPE "PriceSourceType_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");
