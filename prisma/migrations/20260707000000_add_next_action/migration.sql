-- CAM-60: próxima acción comercial en leads (aditivo, sin destructivos)

-- CreateEnum
CREATE TYPE "NextActionType" AS ENUM ('LLAMAR', 'WHATSAPP', 'EMAIL', 'ENVIAR_VEHICULOS', 'PEDIR_DOCS', 'AGENDAR_VISITA', 'SEGUIMIENTO', 'CERRAR');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'PROXIMA_ACCION_ACTUALIZADA';

-- AlterTable
ALTER TABLE "buyer_leads" ADD COLUMN     "next_action_due_at" TIMESTAMP(3),
ADD COLUMN     "next_action_type" "NextActionType";

-- AlterTable
ALTER TABLE "seller_leads" ADD COLUMN     "next_action_due_at" TIMESTAMP(3),
ADD COLUMN     "next_action_type" "NextActionType";

-- CreateIndex
CREATE INDEX "buyer_leads_next_action_due_at_idx" ON "buyer_leads"("next_action_due_at");

-- CreateIndex
CREATE INDEX "seller_leads_next_action_due_at_idx" ON "seller_leads"("next_action_due_at");
