-- Excepción OPS-1 autorizada sólo para desarrollo/pruebas locales. Sin backfill histórico.
-- Los enums se amplían antes de usar sus valores en el CHECK (compatibilidad PostgreSQL).
ALTER TYPE "VehicleDocumentCategory" ADD VALUE 'PRESUPUESTO';
ALTER TYPE "VehicleDocumentCategory" ADD VALUE 'OPERATIVO';
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "vehicle_documents" ALTER COLUMN "vehicle_id" DROP NOT NULL,
  ADD COLUMN "buyer_lead_id" TEXT, ADD COLUMN "seller_lead_id" TEXT,
  ADD COLUMN "creation_key" TEXT, ADD COLUMN "creation_fingerprint" TEXT;
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_buyer_lead_id_fkey"
  FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_seller_lead_id_fkey"
  FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE INDEX "vehicle_documents_buyer_lead_id_idx" ON "vehicle_documents"("buyer_lead_id");
CREATE INDEX "vehicle_documents_seller_lead_id_idx" ON "vehicle_documents"("seller_lead_id");
CREATE UNIQUE INDEX "vehicle_documents_creation_key_key" ON "vehicle_documents"("creation_key");
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_target_check" CHECK (
  num_nonnulls(vehicle_id,buyer_lead_id,seller_lead_id) = 1
  AND (vehicle_id IS NOT NULL OR category::text IN ('PRESUPUESTO','OPERATIVO'))
);
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_operation_key_check"
CHECK ((creation_key IS NULL) = (creation_fingerprint IS NULL));
-- Se conservan RLS, FK compuesta de versión actual y todos los objetos/versiones históricos.
COMMIT;
