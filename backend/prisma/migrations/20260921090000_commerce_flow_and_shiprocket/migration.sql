ALTER TABLE "order_items"
  ADD COLUMN "commission_rate" DECIMAL(5,2),
  ADD COLUMN "commission_amount" DECIMAL(12,2),
  ADD COLUMN "seller_payout" DECIMAL(12,2),
  ADD COLUMN "weight_grams" INTEGER,
  ADD COLUMN "length_cm" DECIMAL(8,2),
  ADD COLUMN "width_cm" DECIMAL(8,2),
  ADD COLUMN "height_cm" DECIMAL(8,2);

ALTER TABLE "seller_profiles"
  ALTER COLUMN "commission_rate" DROP NOT NULL,
  ALTER COLUMN "commission_rate" DROP DEFAULT;

ALTER TABLE "products"
  ALTER COLUMN "seller_id" DROP NOT NULL;

ALTER TABLE "orders"
  ALTER COLUMN "buyer_id" DROP NOT NULL,
  ALTER COLUMN "seller_id" DROP NOT NULL,
  ALTER COLUMN "shipping_address_id" DROP NOT NULL,
  ADD COLUMN "buyer_name" VARCHAR(255),
  ADD COLUMN "buyer_email" VARCHAR(255),
  ADD COLUMN "buyer_mobile" VARCHAR(20),
  ADD COLUMN "shipping_address_snapshot" JSONB,
  ADD COLUMN "source" VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "created_by_id" UUID;

ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'CASH';

ALTER TABLE "order_items"
  ALTER COLUMN "seller_id" DROP NOT NULL;

ALTER TABLE "shipments"
  ADD COLUMN "provider" VARCHAR(50),
  ADD COLUMN "provider_order_id" VARCHAR(100),
  ADD COLUMN "provider_shipment_id" VARCHAR(100),
  ADD COLUMN "courier_id" VARCHAR(100),
  ADD COLUMN "label_url" TEXT,
  ADD COLUMN "manifest_url" TEXT,
  ADD COLUMN "pickup_scheduled_at" TIMESTAMPTZ(6),
  ADD COLUMN "error_message" TEXT;

CREATE UNIQUE INDEX "shipments_provider_order_id_key" ON "shipments"("provider_order_id");
CREATE UNIQUE INDEX "shipments_provider_shipment_id_key" ON "shipments"("provider_shipment_id");

ALTER TABLE "delivery_tracking_events"
  ADD COLUMN "provider_event_key" VARCHAR(255);

CREATE INDEX "orders_source_created_at_idx" ON "orders"("source", "created_at");
CREATE INDEX "orders_created_by_id_idx" ON "orders"("created_by_id");
CREATE INDEX "shipments_provider_tracking_number_idx" ON "shipments"("provider", "tracking_number");

CREATE UNIQUE INDEX "delivery_tracking_events_provider_event_key_key"
  ON "delivery_tracking_events"("provider_event_key");

ALTER TABLE "commission_settings"
  ADD CONSTRAINT "commission_settings_rate_range_check"
    CHECK ("rate" >= 0 AND "rate" <= 100),
  ADD CONSTRAINT "commission_settings_effective_window_check"
    CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "product_categories"
  ADD CONSTRAINT "product_categories_commission_rate_range_check"
    CHECK ("commission_rate" IS NULL OR ("commission_rate" >= 0 AND "commission_rate" <= 100));

ALTER TABLE "seller_profiles"
  ADD CONSTRAINT "seller_profiles_commission_rate_range_check"
    CHECK ("commission_rate" IS NULL OR ("commission_rate" >= 0 AND "commission_rate" <= 100));

ALTER TABLE "products"
  ADD CONSTRAINT "products_commission_rate_range_check"
    CHECK ("commission_rate" IS NULL OR ("commission_rate" >= 0 AND "commission_rate" <= 100));

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_commission_rate_range_check"
    CHECK ("commission_rate" IS NULL OR ("commission_rate" >= 0 AND "commission_rate" <= 100)),
  ADD CONSTRAINT "order_items_commission_amount_nonnegative_check"
    CHECK ("commission_amount" IS NULL OR "commission_amount" >= 0),
  ADD CONSTRAINT "order_items_seller_payout_nonnegative_check"
    CHECK ("seller_payout" IS NULL OR "seller_payout" >= 0),
  ADD CONSTRAINT "order_items_admin_owned_no_payout_check"
    CHECK ("seller_id" IS NOT NULL OR (
      COALESCE("commission_rate", 0) = 0 AND
      COALESCE("commission_amount", 0) = 0 AND
      COALESCE("seller_payout", 0) = 0
    ));

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_admin_owned_no_payout_check"
    CHECK ("seller_id" IS NOT NULL OR (
      "commission_rate" = 0 AND "commission_amount" = 0 AND "seller_payout" = 0
    ));
