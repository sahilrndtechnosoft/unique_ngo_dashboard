ALTER TABLE "seller_profiles"
  ADD COLUMN "shiprocket_pickup_location" VARCHAR(36),
  ADD COLUMN "shiprocket_pickup_address" TEXT,
  ADD COLUMN "shiprocket_pickup_address_2" TEXT,
  ADD COLUMN "shiprocket_pickup_city" VARCHAR(100),
  ADD COLUMN "shiprocket_pickup_state" VARCHAR(100),
  ADD COLUMN "shiprocket_pickup_country" VARCHAR(100),
  ADD COLUMN "shiprocket_pickup_pin_code" VARCHAR(10);
