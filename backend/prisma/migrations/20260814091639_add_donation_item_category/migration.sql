/*
  Warnings:

  - You are about to drop the column `category_id` on the `donation_items` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "donation_item_category" AS ENUM ('FURNITURE', 'CLOTHING', 'MEDICAL_EQUIPMENT', 'ELECTRONICS', 'BOOKS_STATIONERY', 'HOUSEHOLD', 'TOYS', 'OTHER');

-- DropIndex
DROP INDEX "donation_items_category_id_idx";

-- AlterTable
ALTER TABLE "donation_items" DROP COLUMN "category_id",
ADD COLUMN     "category" "donation_item_category";

-- CreateIndex
CREATE INDEX "donation_items_category_idx" ON "donation_items"("category");
