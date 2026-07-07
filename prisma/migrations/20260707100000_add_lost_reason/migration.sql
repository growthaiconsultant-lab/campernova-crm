-- CAM-61: motivo estructurado de pérdida/descarte (aditivo, sin destructivos)

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('PRECIO', 'FINANCIACION', 'COMPRO_A_OTRO', 'NO_RESPONDE', 'APLAZA', 'SIN_STOCK', 'EXPECTATIVAS', 'OTRO');

-- AlterTable
ALTER TABLE "buyer_leads" ADD COLUMN     "lost_reason" "LostReason",
ADD COLUMN     "lost_reason_notes" TEXT;

-- AlterTable
ALTER TABLE "seller_leads" ADD COLUMN     "lost_reason" "LostReason",
ADD COLUMN     "lost_reason_notes" TEXT;
