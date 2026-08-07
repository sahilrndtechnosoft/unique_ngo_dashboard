-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "blood_donations" ADD COLUMN     "appointment_id" UUID,
ADD COLUMN     "hospital_id" UUID;

-- CreateTable
CREATE TABLE "hospitals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "registration_no" VARCHAR(100),
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20),
    "contact_name" VARCHAR(255),
    "contact_mobile" VARCHAR(20),
    "contact_email" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "sheet_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "campaign_type" NOT NULL DEFAULT 'BLOOD',
    "status" "campaign_status" NOT NULL DEFAULT 'DRAFT',
    "hospital_id" UUID,
    "venue_name" VARCHAR(255),
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "banner_url" TEXT,
    "organizer_name" VARCHAR(255),
    "organizer_mobile" VARCHAR(20),
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "target_units" INTEGER,
    "units_collected" INTEGER NOT NULL DEFAULT 0,
    "sheet_url" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "blood_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_donation_appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donor_id" UUID NOT NULL,
    "hospital_id" UUID,
    "campaign_id" UUID,
    "blood_group" "blood_group" NOT NULL,
    "appointment_date" DATE NOT NULL,
    "time_slot" VARCHAR(50),
    "status" "appointment_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "cancel_reason" TEXT,
    "donation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_donation_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_sheet_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hospital_id" UUID,
    "campaign_id" UUID,
    "donor_name" VARCHAR(255),
    "donor_mobile" VARCHAR(20),
    "donor_email" VARCHAR(255),
    "blood_group" VARCHAR(10),
    "units" DECIMAL(5,2),
    "donation_date" DATE,
    "raw_row" JSONB NOT NULL,
    "matched_donation_id" UUID,
    "imported_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_sheet_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hospitals_is_active_idx" ON "hospitals"("is_active");

-- CreateIndex
CREATE INDEX "hospitals_created_at_idx" ON "hospitals"("created_at");

-- CreateIndex
CREATE INDEX "hospitals_deleted_at_idx" ON "hospitals"("deleted_at");

-- CreateIndex
CREATE INDEX "hospitals_city_state_idx" ON "hospitals"("city", "state");

-- CreateIndex
CREATE INDEX "hospitals_created_by_id_idx" ON "hospitals"("created_by_id");

-- CreateIndex
CREATE INDEX "blood_campaigns_status_idx" ON "blood_campaigns"("status");

-- CreateIndex
CREATE INDEX "blood_campaigns_type_idx" ON "blood_campaigns"("type");

-- CreateIndex
CREATE INDEX "blood_campaigns_created_at_idx" ON "blood_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "blood_campaigns_deleted_at_idx" ON "blood_campaigns"("deleted_at");

-- CreateIndex
CREATE INDEX "blood_campaigns_hospital_id_idx" ON "blood_campaigns"("hospital_id");

-- CreateIndex
CREATE INDEX "blood_campaigns_created_by_id_idx" ON "blood_campaigns"("created_by_id");

-- CreateIndex
CREATE INDEX "blood_donation_appointments_status_idx" ON "blood_donation_appointments"("status");

-- CreateIndex
CREATE INDEX "blood_donation_appointments_appointment_date_idx" ON "blood_donation_appointments"("appointment_date");

-- CreateIndex
CREATE INDEX "blood_donation_appointments_created_at_idx" ON "blood_donation_appointments"("created_at");

-- CreateIndex
CREATE INDEX "blood_donation_appointments_donor_id_idx" ON "blood_donation_appointments"("donor_id");

-- CreateIndex
CREATE INDEX "blood_donation_appointments_hospital_id_idx" ON "blood_donation_appointments"("hospital_id");

-- CreateIndex
CREATE INDEX "blood_donation_appointments_campaign_id_idx" ON "blood_donation_appointments"("campaign_id");

-- CreateIndex
CREATE INDEX "blood_donation_appointments_donation_id_idx" ON "blood_donation_appointments"("donation_id");

-- CreateIndex
CREATE INDEX "donation_sheet_records_created_at_idx" ON "donation_sheet_records"("created_at");

-- CreateIndex
CREATE INDEX "donation_sheet_records_hospital_id_idx" ON "donation_sheet_records"("hospital_id");

-- CreateIndex
CREATE INDEX "donation_sheet_records_campaign_id_idx" ON "donation_sheet_records"("campaign_id");

-- CreateIndex
CREATE INDEX "donation_sheet_records_matched_donation_id_idx" ON "donation_sheet_records"("matched_donation_id");

-- CreateIndex
CREATE INDEX "donation_sheet_records_donor_mobile_idx" ON "donation_sheet_records"("donor_mobile");

-- CreateIndex
CREATE INDEX "blood_donations_hospital_id_idx" ON "blood_donations"("hospital_id");

-- CreateIndex
CREATE INDEX "blood_donations_appointment_id_idx" ON "blood_donations"("appointment_id");
