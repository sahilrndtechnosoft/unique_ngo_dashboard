CREATE TABLE "marketplace_moderation_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "previous_status" VARCHAR(50),
    "new_status" VARCHAR(50) NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_moderation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketplace_moderation_events_entity_type_entity_id_created_at_idx"
  ON "marketplace_moderation_events"("entity_type", "entity_id", "created_at");
CREATE INDEX "marketplace_moderation_events_actor_id_created_at_idx"
  ON "marketplace_moderation_events"("actor_id", "created_at");

ALTER TABLE "marketplace_moderation_events"
  ADD CONSTRAINT "marketplace_moderation_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT NOT VALID;
