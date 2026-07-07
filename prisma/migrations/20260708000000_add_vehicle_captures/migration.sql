-- CreateEnum
CREATE TYPE "CapturePortal" AS ENUM ('COCHES_NET', 'WALLAPOP', 'MILANUNCIOS', 'OTRO');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('NO_CONTACTADO', 'CONTACTADO', 'EN_CURSO', 'ENTRADA_AGENDADA', 'CONVERTIDO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "vehicle_captures" (
    "id" TEXT NOT NULL,
    "listing_url" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "portal" "CapturePortal" NOT NULL DEFAULT 'OTRO',
    "title" TEXT,
    "asking_price" DECIMAL(10,2),
    "status" "CaptureStatus" NOT NULL DEFAULT 'NO_CONTACTADO',
    "notes" TEXT,
    "rejection_reason" "LostReason",
    "entrada_scheduled_at" TIMESTAMP(3),
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "seller_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_captures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_captures_seller_lead_id_key" ON "vehicle_captures"("seller_lead_id");

-- CreateIndex
CREATE INDEX "vehicle_captures_status_idx" ON "vehicle_captures"("status");

-- CreateIndex
CREATE INDEX "vehicle_captures_assigned_to_id_status_idx" ON "vehicle_captures"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "vehicle_captures_entrada_scheduled_at_idx" ON "vehicle_captures"("entrada_scheduled_at");

-- AddForeignKey
ALTER TABLE "vehicle_captures" ADD CONSTRAINT "vehicle_captures_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_captures" ADD CONSTRAINT "vehicle_captures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_captures" ADD CONSTRAINT "vehicle_captures_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

