ALTER TABLE "shipments"
  ADD COLUMN "provider_reference_id" VARCHAR(100);

CREATE UNIQUE INDEX "shipments_provider_reference_id_key"
  ON "shipments"("provider_reference_id");
