-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CITA', 'LIMPIEZA', 'SEGUIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('PROGRAMADO', 'CONFIRMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CalendarEventPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "priority" "CalendarEventPriority" NOT NULL DEFAULT 'MEDIA',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "created_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "buyer_lead_id" TEXT,
    "seller_lead_id" TEXT,
    "vehicle_id" TEXT,
    "match_id" TEXT,
    "result_notes" TEXT,
    "internal_notes" TEXT,
    "specific_data" JSONB,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");

-- CreateIndex
CREATE INDEX "calendar_events_assigned_to_id_start_at_idx" ON "calendar_events"("assigned_to_id", "start_at");

-- CreateIndex
CREATE INDEX "calendar_events_buyer_lead_id_idx" ON "calendar_events"("buyer_lead_id");

-- CreateIndex
CREATE INDEX "calendar_events_vehicle_id_idx" ON "calendar_events"("vehicle_id");

-- CreateIndex
CREATE INDEX "calendar_events_status_idx" ON "calendar_events"("status");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

