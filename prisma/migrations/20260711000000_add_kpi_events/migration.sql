-- CreateTable
CREATE TABLE "kpi_events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "actor_user_id" TEXT,
    "source" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_events_event_name_occurred_at_idx" ON "kpi_events"("event_name", "occurred_at");

-- CreateIndex
CREATE INDEX "kpi_events_entity_type_entity_id_idx" ON "kpi_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "kpi_events_occurred_at_idx" ON "kpi_events"("occurred_at");

-- AddForeignKey
ALTER TABLE "kpi_events" ADD CONSTRAINT "kpi_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

