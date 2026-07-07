-- CAM-63: vehículo de parte de pago / trade-in del comprador (aditivo, sin destructivos)

-- CreateEnum
CREATE TYPE "TradeInVehicleType" AS ENUM ('COCHE', 'CAMPER', 'AUTOCARAVANA', 'FURGONETA', 'MOTO', 'OTRO');

-- AlterTable
ALTER TABLE "buyer_leads" ADD COLUMN     "has_trade_in" BOOLEAN,
ADD COLUMN     "trade_in_brand" TEXT,
ADD COLUMN     "trade_in_finance_pending" BOOLEAN,
ADD COLUMN     "trade_in_km" INTEGER,
ADD COLUMN     "trade_in_model" TEXT,
ADD COLUMN     "trade_in_notes" TEXT,
ADD COLUMN     "trade_in_seller_lead_id" TEXT,
ADD COLUMN     "trade_in_type" "TradeInVehicleType",
ADD COLUMN     "trade_in_year" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "buyer_leads_trade_in_seller_lead_id_key" ON "buyer_leads"("trade_in_seller_lead_id");

-- AddForeignKey
ALTER TABLE "buyer_leads" ADD CONSTRAINT "buyer_leads_trade_in_seller_lead_id_fkey" FOREIGN KEY ("trade_in_seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
