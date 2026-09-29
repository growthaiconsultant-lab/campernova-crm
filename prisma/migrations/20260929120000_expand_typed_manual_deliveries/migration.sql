-- OPS-1A, expansión de compatibilidad. No habilita los writers manuales.
-- No se modifica ninguna tabla documental ni se infieren destinatarios históricos.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TYPE "DeliveryKind" AS ENUM ('VENTA', 'DEVOLUCION_VENDEDOR', 'ENTREGA_TALLER');

ALTER TABLE "deliveries"
  ADD COLUMN "kind" "DeliveryKind" NOT NULL DEFAULT 'VENTA',
  ADD COLUMN "recipient_seller_lead_id" TEXT,
  ALTER COLUMN "buyer_lead_id" DROP NOT NULL,
  ALTER COLUMN "offer_id" DROP NOT NULL;

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_recipient_seller_lead_id_fkey"
  FOREIGN KEY ("recipient_seller_lead_id") REFERENCES "seller_leads"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE INDEX "deliveries_recipient_seller_lead_id_idx" ON "deliveries"("recipient_seller_lead_id");

-- Prisma no expresa CHECKs: un único receptor, coherente con el tipo. La oferta sólo tiene
-- sentido para una venta. Se conserva el índice único parcial de entrega activa por vehículo.
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_kind_recipient_check" CHECK (
  ("kind" = 'VENTA' AND "buyer_lead_id" IS NOT NULL AND "recipient_seller_lead_id" IS NULL)
  OR ("kind" = 'DEVOLUCION_VENDEDOR' AND "buyer_lead_id" IS NULL
      AND "recipient_seller_lead_id" IS NOT NULL AND "offer_id" IS NULL)
  OR ("kind" = 'ENTREGA_TALLER' AND "offer_id" IS NULL
      AND (("buyer_lead_id" IS NOT NULL) <> ("recipient_seller_lead_id" IS NOT NULL)))
);
COMMIT;
