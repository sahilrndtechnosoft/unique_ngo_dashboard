-- App settings and banner images

CREATE TABLE IF NOT EXISTS "app_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(50) NOT NULL DEFAULT 'default',
    "company_name" VARCHAR(255),
    "tagline" VARCHAR(500),
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "whatsapp" VARCHAR(50),
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(100) DEFAULT 'India',
    "website_url" TEXT,
    "facebook_url" TEXT,
    "instagram_url" TEXT,
    "twitter_url" TEXT,
    "linkedin_url" TEXT,
    "youtube_url" TEXT,
    "footer_about" TEXT,
    "footer_copyright" VARCHAR(500),
    "footer_extra_html" TEXT,
    "support_hours" VARCHAR(255),
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_key_key" ON "app_settings"("key");

CREATE TABLE IF NOT EXISTS "banner_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255),
    "subtitle" VARCHAR(500),
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "button_text" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "banner_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "banner_images_is_active_idx" ON "banner_images"("is_active");
CREATE INDEX IF NOT EXISTS "banner_images_sort_order_idx" ON "banner_images"("sort_order");
CREATE INDEX IF NOT EXISTS "banner_images_deleted_at_idx" ON "banner_images"("deleted_at");
CREATE INDEX IF NOT EXISTS "banner_images_created_at_idx" ON "banner_images"("created_at");
