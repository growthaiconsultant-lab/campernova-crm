-- A3 — Valoración preliminar vs tasación oficial (aditivo; sin DML ni backfill).
--
-- Añade:
--   · enum ValuationPurpose (PRELIMINAR | OFICIAL);
--   · enum ValuationOutcome (COMPLETADA | SIN_REFERENCIA | FALLO_TECNICO);
--   · Valuation.purpose NULLABLE (sin backfill; `null` = LEGACY/UNKNOWN, ver DATA-1);
--   · tabla append-only vehicle_valuation_attempts (admite intentos SIN cifras).
--
-- Compatibilidad de rollout:
--   · old code + new schema: compatible (columna nullable, tabla nueva no leída por el código viejo);
--   · new code + old schema: INCOMPATIBLE (lee purpose + escribe attempts). Esta migración DEBE
--     aplicarse ANTES de desplegar el código A3.

-- CreateEnum
CREATE TYPE "ValuationPurpose" AS ENUM ('PRELIMINAR', 'OFICIAL');

-- CreateEnum
CREATE TYPE "ValuationOutcome" AS ENUM ('COMPLETADA', 'SIN_REFERENCIA', 'FALLO_TECNICO');

-- AlterTable
ALTER TABLE "valuations" ADD COLUMN     "purpose" "ValuationPurpose";

-- CreateTable
CREATE TABLE "vehicle_valuation_attempts" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "purpose" "ValuationPurpose" NOT NULL,
    "outcome" "ValuationOutcome" NOT NULL,
    "method" "ValuationMethod" NOT NULL,
    "confidence" "ValuationConfidence",
    "min" DECIMAL(10,2),
    "recommended" DECIMAL(10,2),
    "max" DECIMAL(10,2),
    "reference_used" TEXT,
    "reason" TEXT,
    "error_code" TEXT,
    "created_by_id" TEXT,
    "valuation_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_valuation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_valuation_attempts_vehicle_id_idx" ON "vehicle_valuation_attempts"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_valuation_attempts_vehicle_id_purpose_idx" ON "vehicle_valuation_attempts"("vehicle_id", "purpose");

-- CreateIndex
CREATE INDEX "vehicle_valuation_attempts_created_at_idx" ON "vehicle_valuation_attempts"("created_at");

-- CreateIndex
CREATE INDEX "vehicle_valuation_attempts_outcome_idx" ON "vehicle_valuation_attempts"("outcome");

-- CreateIndex
-- Idempotencia de la tasación oficial: unique sobre la clave (nullable → múltiples NULL permitidos,
-- así los intentos PRELIMINAR sin clave no colisionan; solo se deduplican los oficiales con clave).
CREATE UNIQUE INDEX "vehicle_valuation_attempts_idempotency_key_key" ON "vehicle_valuation_attempts"("idempotency_key");

-- AddForeignKey
ALTER TABLE "vehicle_valuation_attempts" ADD CONSTRAINT "vehicle_valuation_attempts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_valuation_attempts" ADD CONSTRAINT "vehicle_valuation_attempts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_valuation_attempts" ADD CONSTRAINT "vehicle_valuation_attempts_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "valuations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EnableRowLevelSecurity
-- Personalización manual (Prisma no la genera). Invariante del repositorio: TODA tabla de
-- `public` debe tener RLS activada (deny-all para anon/authenticated; Prisma accede con un rol
-- BYPASSRLS). Sin esta línea, `pnpm check:rls` falla y el conteo `tables_without_rls` deja de ser 0.
ALTER TABLE "vehicle_valuation_attempts" ENABLE ROW LEVEL SECURITY;
