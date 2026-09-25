CREATE UNIQUE INDEX "products_active_sku_unique"
  ON "products" ("sku")
  WHERE "sku" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "product_variants_sku_unique"
  ON "product_variants" ("sku")
  WHERE "sku" IS NOT NULL;
