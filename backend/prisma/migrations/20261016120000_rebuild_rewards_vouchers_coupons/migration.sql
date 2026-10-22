-- CreateEnum
CREATE TYPE "catalog_item_type" AS ENUM ('PARTNER_VOUCHER', 'STORE_COUPON', 'PRODUCT', 'DONATION_BOOST');

-- CreateEnum
CREATE TYPE "voucher_status" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ledger_entry_type" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "coupon_usage_status" AS ENUM ('APPLIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "redemption_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- AlterTable: coupon_usages
ALTER TABLE "coupon_usages" ADD COLUMN "reversal_reason" TEXT,
ADD COLUMN "reversed_at" TIMESTAMPTZ(6),
ADD COLUMN "status" "coupon_usage_status" NOT NULL DEFAULT 'APPLIED';

-- AlterTable: coupons
ALTER TABLE "coupons" ADD COLUMN "free_shipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "partner_store_id" UUID,
ADD COLUMN "stacking_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stacking_group" VARCHAR(50);

-- AlterTable: reward_redemptions
ALTER TABLE "reward_redemptions" ADD COLUMN "catalog_item_id" UUID,
ADD COLUMN "failure_reason" TEXT,
ADD COLUMN "idempotency_key" VARCHAR(128),
ADD COLUMN "partner_store_id" UUID,
ADD COLUMN "voucher_id" UUID,
DROP COLUMN "status",
ADD COLUMN "status" "redemption_status" NOT NULL DEFAULT 'PENDING';

-- CreateTable: partner_stores
CREATE TABLE "partner_stores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "website_url" TEXT,
    "category" VARCHAR(100) NOT NULL DEFAULT 'FOOD_BEVERAGE',
    "adapter_type" VARCHAR(50) NOT NULL DEFAULT 'MOCK',
    "api_endpoint" TEXT,
    "api_key_hash" TEXT,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rewards_catalog_items
CREATE TABLE "rewards_catalog_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_store_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "category" VARCHAR(100) NOT NULL DEFAULT 'VOUCHER',
    "points_cost" INTEGER NOT NULL,
    "monetary_value" DECIMAL(10,2) NOT NULL,
    "item_type" "catalog_item_type" NOT NULL DEFAULT 'PARTNER_VOUCHER',
    "stock" INTEGER,
    "validity_days" INTEGER NOT NULL DEFAULT 30,
    "min_user_tier" VARCHAR(50) NOT NULL DEFAULT 'BRONZE',
    "terms_and_conditions" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: vouchers
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "user_id" UUID NOT NULL,
    "catalog_item_id" UUID,
    "partner_store_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "points_spent" INTEGER NOT NULL,
    "monetary_value" DECIMAL(10,2) NOT NULL,
    "status" "voucher_status" NOT NULL DEFAULT 'ACTIVE',
    "security_pin" VARCHAR(20),
    "qr_payload" TEXT,
    "partner_reference" VARCHAR(255),
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "redeemed_at" TIMESTAMPTZ(6),
    "redeemed_store_location" VARCHAR(255),
    "redeemed_by_partner_id" VARCHAR(255),
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reward_ledger_entries
CREATE TABLE "reward_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entry_type" "ledger_entry_type" NOT NULL,
    "activity" "reward_activity",
    "rule_id" UUID,
    "points" INTEGER NOT NULL,
    "remaining_points" INTEGER NOT NULL DEFAULT 0,
    "balance_after" INTEGER NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "description" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" VARCHAR(128),
    "performed_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: redemption_audit_logs
CREATE TABLE "redemption_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "actor_type" VARCHAR(50) NOT NULL,
    "actor_id" UUID,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemption_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_stores_slug_key" ON "partner_stores"("slug");
CREATE INDEX "partner_stores_is_active_idx" ON "partner_stores"("is_active");
CREATE INDEX "partner_stores_category_idx" ON "partner_stores"("category");
CREATE INDEX "partner_stores_created_at_idx" ON "partner_stores"("created_at");

-- CreateIndex
CREATE INDEX "rewards_catalog_items_is_active_idx" ON "rewards_catalog_items"("is_active");
CREATE INDEX "rewards_catalog_items_partner_store_id_idx" ON "rewards_catalog_items"("partner_store_id");
CREATE INDEX "rewards_catalog_items_category_idx" ON "rewards_catalog_items"("category");
CREATE INDEX "rewards_catalog_items_points_cost_idx" ON "rewards_catalog_items"("points_cost");
CREATE INDEX "rewards_catalog_items_created_at_idx" ON "rewards_catalog_items"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");
CREATE UNIQUE INDEX "vouchers_idempotency_key_key" ON "vouchers"("idempotency_key");
CREATE INDEX "vouchers_user_id_idx" ON "vouchers"("user_id");
CREATE INDEX "vouchers_status_idx" ON "vouchers"("status");
CREATE INDEX "vouchers_partner_store_id_idx" ON "vouchers"("partner_store_id");
CREATE INDEX "vouchers_catalog_item_id_idx" ON "vouchers"("catalog_item_id");
CREATE INDEX "vouchers_expires_at_idx" ON "vouchers"("expires_at");
CREATE INDEX "vouchers_created_at_idx" ON "vouchers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reward_ledger_entries_idempotency_key_key" ON "reward_ledger_entries"("idempotency_key");
CREATE INDEX "reward_ledger_entries_wallet_id_idx" ON "reward_ledger_entries"("wallet_id");
CREATE INDEX "reward_ledger_entries_user_id_idx" ON "reward_ledger_entries"("user_id");
CREATE INDEX "reward_ledger_entries_entry_type_idx" ON "reward_ledger_entries"("entry_type");
CREATE INDEX "reward_ledger_entries_expires_at_is_expired_idx" ON "reward_ledger_entries"("expires_at", "is_expired");
CREATE INDEX "reward_ledger_entries_created_at_idx" ON "reward_ledger_entries"("created_at");
CREATE INDEX "reward_ledger_entries_reference_type_reference_id_idx" ON "reward_ledger_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "redemption_audit_logs_entity_type_entity_id_idx" ON "redemption_audit_logs"("entity_type", "entity_id");
CREATE INDEX "redemption_audit_logs_event_type_idx" ON "redemption_audit_logs"("event_type");
CREATE INDEX "redemption_audit_logs_actor_id_idx" ON "redemption_audit_logs"("actor_id");
CREATE INDEX "redemption_audit_logs_created_at_idx" ON "redemption_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "coupon_usages_status_idx" ON "coupon_usages"("status");

-- CreateIndex
CREATE INDEX "coupons_partner_store_id_idx" ON "coupons"("partner_store_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_idempotency_key_key" ON "reward_redemptions"("idempotency_key");
CREATE INDEX "reward_redemptions_status_idx" ON "reward_redemptions"("status");
CREATE INDEX "reward_redemptions_voucher_id_idx" ON "reward_redemptions"("voucher_id");
CREATE INDEX "reward_redemptions_catalog_item_id_idx" ON "reward_redemptions"("catalog_item_id");
CREATE INDEX "reward_redemptions_partner_store_id_idx" ON "reward_redemptions"("partner_store_id");
