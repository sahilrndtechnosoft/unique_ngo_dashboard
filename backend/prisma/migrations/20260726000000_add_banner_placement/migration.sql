DO $$ BEGIN
    CREATE TYPE "banner_placement" AS ENUM ('HOME', 'CATEGORY', 'PRODUCT', 'CHECKOUT', 'SIDEBAR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "banner_images" ADD COLUMN IF NOT EXISTS "placement" "banner_placement" NOT NULL DEFAULT 'HOME';

CREATE INDEX IF NOT EXISTS "banner_images_placement_idx" ON "banner_images"("placement");
