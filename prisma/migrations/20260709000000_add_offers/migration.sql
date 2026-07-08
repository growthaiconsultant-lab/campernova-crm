-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PROPUESTA', 'CONTRAOFERTA', 'ACEPTADA', 'CONVERTIDA', 'RECHAZADA', 'EXPIRADA', 'RETIRADA', 'CANCELADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'OFERTA_REGISTRADA';
ALTER TYPE "ActivityType" ADD VALUE 'OFERTA_ACTUALIZADA';

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "buyer_lead_id" TEXT NOT NULL,
    "match_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2),
    "status" "OfferStatus" NOT NULL DEFAULT 'PROPUESTA',
    "reserved_until" TIMESTAMP(3),
    "notes" TEXT,
    "rejection_reason" "LostReason",
    "created_by_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offers_vehicle_id_status_idx" ON "offers"("vehicle_id", "status");

-- CreateIndex
CREATE INDEX "offers_buyer_lead_id_status_idx" ON "offers"("buyer_lead_id", "status");

-- CreateIndex
CREATE INDEX "offers_status_idx" ON "offers"("status");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

