-- AlterTable
ALTER TABLE "blood_donation_appointments" ADD COLUMN     "beneficiary_mobile" VARCHAR(20),
ADD COLUMN     "beneficiary_name" VARCHAR(255),
ADD COLUMN     "beneficiary_relation" VARCHAR(100),
ADD COLUMN     "for_self" BOOLEAN NOT NULL DEFAULT true;
