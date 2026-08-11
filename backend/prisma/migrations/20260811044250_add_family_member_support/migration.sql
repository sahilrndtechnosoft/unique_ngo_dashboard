-- AlterTable
ALTER TABLE "blood_donations" ADD COLUMN     "beneficiary_mobile" VARCHAR(20),
ADD COLUMN     "beneficiary_name" VARCHAR(255),
ADD COLUMN     "beneficiary_relation" VARCHAR(100),
ADD COLUMN     "for_self" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "blood_requests" ADD COLUMN     "for_self" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "patient_relation" VARCHAR(100);
