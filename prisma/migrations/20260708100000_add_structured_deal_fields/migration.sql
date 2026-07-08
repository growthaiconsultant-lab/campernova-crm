-- CreateEnum
CREATE TYPE "SellerDealType" AS ENUM ('DEPOSITO_VENTA', 'COMPRA_DIRECTA', 'PARTE_PAGO', 'INDECISO');
-- CreateEnum
CREATE TYPE "SellerUrgency" AS ENUM ('ALTA', 'MEDIA', 'BAJA');
-- CreateEnum
CREATE TYPE "SellerRisk" AS ENUM ('BAJO', 'MEDIO', 'ALTO');
-- AlterTable
ALTER TABLE "buyer_leads" ADD COLUMN     "financing_needed" BOOLEAN,
ADD COLUMN     "max_monthly_payment" DECIMAL(10,2);
-- AlterTable
ALTER TABLE "seller_leads" ADD COLUMN     "deal_type" "SellerDealType",
ADD COLUMN     "min_price" DECIMAL(10,2),
ADD COLUMN     "risk_level" "SellerRisk",
ADD COLUMN     "risk_notes" TEXT,
ADD COLUMN     "urgency" "SellerUrgency";
