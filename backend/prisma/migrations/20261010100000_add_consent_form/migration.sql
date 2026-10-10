ALTER TABLE "blood_donation_appointments"
  ADD COLUMN "has_consent_form" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "blood_donations"
  ADD COLUMN "has_consent_form" BOOLEAN NOT NULL DEFAULT false;
