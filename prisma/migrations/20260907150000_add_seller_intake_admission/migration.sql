-- INTAKE-1: separa el origen de una solicitud de su admisión en el flujo operativo.
-- El default ADMITIDO mantiene compatible al cliente anterior y a todos los writers internos.
CREATE TYPE "SellerIntakeStatus" AS ENUM ('PENDIENTE', 'ADMITIDO', 'RECHAZADO');

ALTER TYPE "ActivityType" ADD VALUE 'SOLICITUD_WEB_ADMITIDA';
ALTER TYPE "ActivityType" ADD VALUE 'SOLICITUD_WEB_RECHAZADA';

ALTER TABLE "seller_leads"
  ADD COLUMN "intake_status" "SellerIntakeStatus" NOT NULL DEFAULT 'ADMITIDO',
  ADD COLUMN "intake_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "intake_reviewed_by_id" TEXT;

-- Histórico inequívoco: un formulario web ya descartado conserva esa decisión.
UPDATE "seller_leads"
SET "intake_status" = 'RECHAZADO'
WHERE "canal" = 'PRO' AND "status" = 'DESCARTADO';

-- Backfill conservador: solo quedan pendientes las solicitudes web todavía nuevas, sin responsable,
-- sin entrada oficial y cuyo vehículo tampoco avanzó. Cualquier señal operativa conserva ADMITIDO.
UPDATE "seller_leads" AS s
SET "intake_status" = 'PENDIENTE'
FROM "vehicles" AS v
WHERE v."seller_lead_id" = s."id"
  AND s."canal" = 'PRO'
  AND s."status" = 'NUEVO'
  AND s."agent_id" IS NULL
  AND s."intake_status" <> 'RECHAZADO'
  AND v."status" = 'NUEVO'
  AND v."entry_validated_at" IS NULL;

CREATE INDEX "seller_leads_intake_status_created_at_idx"
  ON "seller_leads"("intake_status", "created_at");

ALTER TABLE "seller_leads"
  ADD CONSTRAINT "seller_leads_intake_reviewed_by_id_fkey"
  FOREIGN KEY ("intake_reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
