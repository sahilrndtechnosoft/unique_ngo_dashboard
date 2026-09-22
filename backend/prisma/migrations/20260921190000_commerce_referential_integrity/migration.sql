-- Enforce relationships on new commerce writes without deleting or rejecting
-- legacy records that currently reference missing rows. Validate existing data
-- only after the historical orphan records have been reviewed and repaired.

CREATE INDEX "coupon_usages_order_id_idx" ON "coupon_usages"("order_id");
CREATE INDEX "product_reviews_product_id_idx" ON "product_reviews"("product_id");
CREATE INDEX "product_reviews_reviewer_id_idx" ON "product_reviews"("reviewer_id");

ALTER TABLE "commission_settings"
  ADD CONSTRAINT "commission_settings_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") NOT VALID,
  ADD CONSTRAINT "commission_settings_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") NOT VALID,
  ADD CONSTRAINT "commission_settings_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") NOT VALID;

ALTER TABLE "coupon_usages"
  ADD CONSTRAINT "coupon_usages_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") NOT VALID,
  ADD CONSTRAINT "coupon_usages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") NOT VALID,
  ADD CONSTRAINT "coupon_usages_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") NOT VALID;

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") NOT VALID;

ALTER TABLE "delivery_tracking_events"
  ADD CONSTRAINT "delivery_tracking_events_shipment_id_fkey"
    FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") NOT VALID;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") NOT VALID,
  ADD CONSTRAINT "order_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") NOT VALID,
  ADD CONSTRAINT "order_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") NOT VALID,
  ADD CONSTRAINT "order_items_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") NOT VALID;

ALTER TABLE "order_return_items"
  ADD CONSTRAINT "order_return_items_return_id_fkey"
    FOREIGN KEY ("return_id") REFERENCES "order_returns"("id") NOT VALID,
  ADD CONSTRAINT "order_return_items_order_item_id_fkey"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") NOT VALID;

ALTER TABLE "order_returns"
  ADD CONSTRAINT "order_returns_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") NOT VALID,
  ADD CONSTRAINT "order_returns_buyer_id_fkey"
    FOREIGN KEY ("buyer_id") REFERENCES "users"("id") NOT VALID,
  ADD CONSTRAINT "order_returns_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") NOT VALID,
  ADD CONSTRAINT "order_returns_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") NOT VALID;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_buyer_id_fkey"
    FOREIGN KEY ("buyer_id") REFERENCES "users"("id") NOT VALID,
  ADD CONSTRAINT "orders_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") NOT VALID,
  ADD CONSTRAINT "orders_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") NOT VALID,
  ADD CONSTRAINT "orders_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") NOT VALID,
  ADD CONSTRAINT "orders_cancelled_by_id_fkey"
    FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") NOT VALID,
  ADD CONSTRAINT "orders_shipping_address_id_fkey"
    FOREIGN KEY ("shipping_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL NOT VALID;

ALTER TABLE "product_categories"
  ADD CONSTRAINT "product_categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") NOT VALID;

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") NOT VALID;

ALTER TABLE "product_inventory_logs"
  ADD CONSTRAINT "product_inventory_logs_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") NOT VALID,
  ADD CONSTRAINT "product_inventory_logs_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") NOT VALID,
  ADD CONSTRAINT "product_inventory_logs_performed_by_id_fkey"
    FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") NOT VALID;

ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") NOT VALID,
  ADD CONSTRAINT "product_reviews_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") NOT VALID,
  ADD CONSTRAINT "product_reviews_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") NOT VALID;

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") NOT VALID;

ALTER TABLE "products"
  ADD CONSTRAINT "products_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") NOT VALID,
  ADD CONSTRAINT "products_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") NOT VALID,
  ADD CONSTRAINT "products_verified_by_id_fkey"
    FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") NOT VALID;

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") NOT VALID;

ALTER TABLE "seller_profiles"
  ADD CONSTRAINT "seller_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") NOT VALID,
  ADD CONSTRAINT "seller_profiles_verified_by_id_fkey"
    FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") NOT VALID;

ALTER TABLE "user_addresses"
  ADD CONSTRAINT "user_addresses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") NOT VALID;
