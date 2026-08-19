-- CreateTable
CREATE TABLE "blood_bank_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(50) NOT NULL DEFAULT 'default',
    "donation_eligibility_months" INTEGER NOT NULL DEFAULT 3,
    "tattoo_eligibility_months" INTEGER NOT NULL DEFAULT 6,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_bank_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blood_bank_settings_key_key" ON "blood_bank_settings"("key");
