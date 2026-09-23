CREATE TYPE "suggestion_status" AS ENUM ('NEW', 'REVIEWING', 'PLANNED', 'IMPLEMENTED', 'DECLINED');

CREATE TABLE "suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_email" VARCHAR(255),
    "customer_mobile" VARCHAR(20),
    "category" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "details" TEXT NOT NULL,
    "status" "suggestion_status" NOT NULL DEFAULT 'NEW',
    "admin_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "suggestions_user_id_idx" ON "suggestions"("user_id");
CREATE INDEX "suggestions_status_idx" ON "suggestions"("status");
CREATE INDEX "suggestions_created_at_idx" ON "suggestions"("created_at");

ALTER TABLE "suggestions"
  ADD CONSTRAINT "suggestions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") NOT VALID,
  ADD CONSTRAINT "suggestions_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") NOT VALID;
