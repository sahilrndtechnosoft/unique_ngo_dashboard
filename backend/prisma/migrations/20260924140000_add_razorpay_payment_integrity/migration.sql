ALTER TABLE "payments" ADD COLUMN "verified_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "payments_gateway_order_id_unique"
  ON "payments" ("gateway_order_id")
  WHERE "gateway_order_id" IS NOT NULL;

CREATE UNIQUE INDEX "payments_gateway_payment_id_unique"
  ON "payments" ("gateway_payment_id")
  WHERE "gateway_payment_id" IS NOT NULL;
