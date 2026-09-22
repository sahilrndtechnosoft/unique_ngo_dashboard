WITH ranked_images AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "product_id"
      ORDER BY "is_primary" DESC, "sort_order" ASC, "created_at" ASC, "id" ASC
    ) AS position
  FROM "product_images"
)
UPDATE "product_images" AS image
SET "is_primary" = (ranked.position = 1)
FROM ranked_images AS ranked
WHERE image."id" = ranked."id";

CREATE UNIQUE INDEX "product_images_single_primary_per_product_key"
  ON "product_images" ("product_id")
  WHERE "is_primary";
