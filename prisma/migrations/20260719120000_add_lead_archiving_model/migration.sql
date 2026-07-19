-- CreateEnum
CREATE TYPE "ArchiveReason" AS ENUM ('SIN_RESPUESTA', 'FUERA_DE_MERCADO', 'POSIBLE_DUPLICADO', 'PRUEBA_INTERNA', 'LIMPIEZA_BANDEJA', 'OTRO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'LEAD_ARCHIVADO';
ALTER TYPE "ActivityType" ADD VALUE 'LEAD_REACTIVADO';

-- AlterTable
ALTER TABLE "seller_leads" ADD COLUMN     "archive_notes" TEXT,
ADD COLUMN     "archive_reason" "ArchiveReason",
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_by_id" TEXT;

-- AlterTable
ALTER TABLE "buyer_leads" ADD COLUMN     "archive_notes" TEXT,
ADD COLUMN     "archive_reason" "ArchiveReason",
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_by_id" TEXT;

-- CreateIndex
CREATE INDEX "seller_leads_archived_at_idx" ON "seller_leads"("archived_at");

-- CreateIndex
CREATE INDEX "buyer_leads_archived_at_idx" ON "buyer_leads"("archived_at");

-- AddForeignKey
ALTER TABLE "seller_leads" ADD CONSTRAINT "seller_leads_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_leads" ADD CONSTRAINT "buyer_leads_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

