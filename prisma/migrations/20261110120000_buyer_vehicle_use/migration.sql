CREATE TYPE "BuyerVehicleUse" AS ENUM ('ESCAPADAS', 'VIAJES_LARGOS', 'VIVIENDA', 'VIVIENDA_TEMPORADAS', 'VIVIENDA_ANUAL', 'OTRO');

ALTER TABLE "buyer_leads"
  ADD COLUMN "intended_use" "BuyerVehicleUse",
  ADD COLUMN "other_use" TEXT;
