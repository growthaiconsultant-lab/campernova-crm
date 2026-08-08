-- REL-1: relación comercial manual comprador–vehículo.
-- Expand-only: los datos existentes conservan score y el cliente anterior tolera las columnas nuevas.
CREATE TYPE "MatchLinkReason" AS ENUM (
  'INTERES_COMPRADOR',
  'RECOMENDACION_EQUIPO',
  'SEGUIMIENTO_COMERCIAL',
  'VISITA_RELACIONADA',
  'OTRO'
);

ALTER TABLE "matches"
  ALTER COLUMN "score" DROP NOT NULL,
  ADD COLUMN "manual_link_reason" "MatchLinkReason",
  ADD COLUMN "manual_link_notes" TEXT,
  ADD COLUMN "manual_linked_at" TIMESTAMP(3),
  ADD COLUMN "manual_linked_by_id" TEXT;

ALTER TABLE "matches"
  ADD CONSTRAINT "matches_score_range_check"
  CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100));

ALTER TABLE "matches"
  ADD CONSTRAINT "matches_manual_linked_by_id_fkey"
  FOREIGN KEY ("manual_linked_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "matches_manual_linked_by_id_idx" ON "matches"("manual_linked_by_id");
