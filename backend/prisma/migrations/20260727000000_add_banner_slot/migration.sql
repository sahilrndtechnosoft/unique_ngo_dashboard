ALTER TABLE "banner_images" ADD COLUMN IF NOT EXISTS "slot" VARCHAR(50) NOT NULL DEFAULT 'TOP';

DROP INDEX IF EXISTS "banner_images_placement_idx";
CREATE INDEX IF NOT EXISTS "banner_images_placement_slot_idx" ON "banner_images"("placement", "slot");
