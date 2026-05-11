-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DeliveryChecklistCategory" AS ENUM ('PRE_ENTREGA', 'EXPLICACION', 'FIRMA_SALIDA');

-- CreateEnum
CREATE TYPE "DeliveryChecklistResult" AS ENUM ('PENDIENTE', 'OK', 'INCIDENCIA', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "DeliveryDocumentCategory" AS ENUM ('CONTRATO_FINAL', 'FACTURA', 'DOCUMENTO_ENTREGA', 'FOTO_ENTREGA', 'OTRO');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ABIERTO', 'EN_PROGRESO', 'RESUELTO', 'CERRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TicketPhotoType" AS ENUM ('PROBLEMA', 'SOLUCION');

-- CreateEnum
CREATE TYPE "FollowupType" AS ENUM ('DIA_7', 'DIA_30');

-- CreateEnum
CREATE TYPE "FollowupStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'RESPONDIDO', 'FALLIDO');

ALTER TYPE "ActivityType" ADD VALUE 'ENTREGA_PROGRAMADA';
ALTER TYPE "ActivityType" ADD VALUE 'ENTREGA_COMPLETADA';
ALTER TYPE "ActivityType" ADD VALUE 'ENTREGA_CANCELADA';
ALTER TYPE "ActivityType" ADD VALUE 'GARANTIA_ACTIVADA';
ALTER TYPE "ActivityType" ADD VALUE 'GARANTIA_AMPLIADA';
ALTER TYPE "ActivityType" ADD VALUE 'TICKET_POSTVENTA_ABIERTO';
ALTER TYPE "ActivityType" ADD VALUE 'TICKET_POSTVENTA_RESUELTO';
ALTER TYPE "ActivityType" ADD VALUE 'TICKET_POSTVENTA_CERRADO';
ALTER TYPE "ActivityType" ADD VALUE 'FOLLOWUP_ENVIADO';
ALTER TYPE "ActivityType" ADD VALUE 'FOLLOWUP_RESPONDIDO';

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "buyer_lead_id" TEXT NOT NULL,
    "responsable_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "signed_by_name" TEXT,
    "signed_by_dni" TEXT,
    "signature_url" TEXT,
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_checklist_items" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "category" "DeliveryChecklistCategory" NOT NULL,
    "item" TEXT NOT NULL,
    "result" "DeliveryChecklistResult" NOT NULL DEFAULT 'PENDIENTE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_documents" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "category" "DeliveryDocumentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "buyer_lead_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "extended_to" TIMESTAMP(3),
    "extended_at" TIMESTAMP(3),
    "extended_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postventa_tickets" (
    "id" TEXT NOT NULL,
    "warranty_id" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ABIERTO',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIA',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cause" TEXT,
    "solution" TEXT,
    "cost_estimate" DECIMAL(10,2),
    "cost_real" DECIMAL(10,2),
    "responsible_id" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "postventa_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postventa_ticket_photos" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "type" "TicketPhotoType" NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "postventa_ticket_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postventa_followups" (
    "id" TEXT NOT NULL,
    "warranty_id" TEXT NOT NULL,
    "type" "FollowupType" NOT NULL,
    "status" "FollowupStatus" NOT NULL DEFAULT 'PENDIENTE',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "response_notes" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "postventa_followups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliveries_vehicle_id_idx" ON "deliveries"("vehicle_id");
CREATE INDEX "deliveries_buyer_lead_id_idx" ON "deliveries"("buyer_lead_id");
CREATE INDEX "deliveries_responsable_id_status_idx" ON "deliveries"("responsable_id", "status");
CREATE INDEX "deliveries_status_scheduled_at_idx" ON "deliveries"("status", "scheduled_at");
CREATE INDEX "delivery_checklist_items_delivery_id_category_idx" ON "delivery_checklist_items"("delivery_id", "category");
CREATE INDEX "delivery_documents_delivery_id_idx" ON "delivery_documents"("delivery_id");
CREATE UNIQUE INDEX "warranties_vehicle_id_key" ON "warranties"("vehicle_id");
CREATE UNIQUE INDEX "warranties_delivery_id_key" ON "warranties"("delivery_id");
CREATE UNIQUE INDEX "warranties_buyer_lead_id_key" ON "warranties"("buyer_lead_id");
CREATE INDEX "warranties_vehicle_id_idx" ON "warranties"("vehicle_id");
CREATE INDEX "warranties_end_date_idx" ON "warranties"("end_date");
CREATE INDEX "postventa_tickets_warranty_id_status_idx" ON "postventa_tickets"("warranty_id", "status");
CREATE INDEX "postventa_tickets_responsible_id_status_idx" ON "postventa_tickets"("responsible_id", "status");
CREATE INDEX "postventa_tickets_status_priority_due_at_idx" ON "postventa_tickets"("status", "priority", "due_at");
CREATE INDEX "postventa_ticket_photos_ticket_id_type_idx" ON "postventa_ticket_photos"("ticket_id", "type");
CREATE INDEX "postventa_followups_status_scheduled_for_idx" ON "postventa_followups"("status", "scheduled_for");
CREATE UNIQUE INDEX "postventa_followups_warranty_id_type_key" ON "postventa_followups"("warranty_id", "type");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_checklist_items" ADD CONSTRAINT "delivery_checklist_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_documents" ADD CONSTRAINT "delivery_documents_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_documents" ADD CONSTRAINT "delivery_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_extended_by_id_fkey" FOREIGN KEY ("extended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "postventa_tickets" ADD CONSTRAINT "postventa_tickets_warranty_id_fkey" FOREIGN KEY ("warranty_id") REFERENCES "warranties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "postventa_tickets" ADD CONSTRAINT "postventa_tickets_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "postventa_ticket_photos" ADD CONSTRAINT "postventa_ticket_photos_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "postventa_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "postventa_ticket_photos" ADD CONSTRAINT "postventa_ticket_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "postventa_followups" ADD CONSTRAINT "postventa_followups_warranty_id_fkey" FOREIGN KEY ("warranty_id") REFERENCES "warranties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
