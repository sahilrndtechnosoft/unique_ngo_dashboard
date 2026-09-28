ALTER TABLE "blood_donation_appointments"
  ADD COLUMN "last_donation_date" DATE,
  ADD COLUMN "had_tattoo_recently" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tattoo_date" DATE,
  ADD COLUMN "city" VARCHAR(100),
  ADD COLUMN "state" VARCHAR(100),
  ADD COLUMN "contact_phone" VARCHAR(20);
