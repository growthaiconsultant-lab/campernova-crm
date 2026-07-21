-- I3C1A (expand): enlace opcional Delivery → Offer + unicidad de Delivery activa por vehículo.
-- La columna es NULLABLE a propósito para que el código actualmente desplegado (que no envía
-- offer_id) siga funcionando durante el rollout. I3C1B la hará NOT NULL tras validar cero nulls.

-- Columna nullable (compatible hacia atrás).
ALTER TABLE "deliveries" ADD COLUMN "offer_id" TEXT;

-- FK NO ACTION (no Restrict): borrar la Offer directamente falla si tiene Delivery, pero borrar el
-- Vehicle padre elimina Offer y Delivery mediante sus cascadas convergentes (verificación diferida).
ALTER TABLE "deliveries"
  ADD CONSTRAINT "deliveries_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "offers"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Índice de la FK.
CREATE INDEX "deliveries_offer_id_idx" ON "deliveries"("offer_id");

-- Índice único parcial: como máximo una Delivery PROGRAMADA o EN_CURSO por vehículo.
CREATE UNIQUE INDEX "deliveries_active_vehicle_key"
  ON "deliveries"("vehicle_id")
  WHERE "status" IN ('PROGRAMADA', 'EN_CURSO');
