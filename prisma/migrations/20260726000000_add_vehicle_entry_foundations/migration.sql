-- CreateEnum
CREATE TYPE "EntryAnnulmentReason" AS ENUM ('PROPIETARIO_DESISTE', 'VEHICULO_RETIRADO', 'CONTRATO_ANULADO', 'DATOS_DOCUMENTACION_INVALIDOS', 'VEHICULO_NO_ACEPTADO', 'DUPLICADO', 'ERROR_ADMINISTRATIVO', 'OTRO');

-- CreateEnum
CREATE TYPE "DocumentRequirementDisposition" AS ENUM ('PENDIENTE', 'NO_DISPONIBLE', 'NO_APLICABLE');

-- AlterEnum
-- El valor se AÑADE aquí pero NO se usa en esta migración (ningún índice, constraint ni DML lo
-- referencia). Cualquier objeto que dependa de él se creará en una migración posterior (A2).
ALTER TYPE "VehicleDocumentCategory" ADD VALUE 'CONTRATO_GESTION';

-- AlterEnum
-- Ídem: `INSPECCION_ENTRADA` queda declarado y sin uso en esta migración. El índice único
-- parcial de "orden de inspección activa" pertenece a A2, ya con el valor confirmado.
ALTER TYPE "WorkOrderKind" ADD VALUE 'INSPECCION_ENTRADA';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "entry_annulled_at" TIMESTAMP(3),
ADD COLUMN     "entry_annulled_by_id" TEXT,
ADD COLUMN     "entry_annulment_notes" TEXT,
ADD COLUMN     "entry_annulment_reason" "EntryAnnulmentReason",
ADD COLUMN     "entry_validated_at" TIMESTAMP(3),
ADD COLUMN     "entry_validated_by_id" TEXT,
ADD COLUMN     "keys_count" INTEGER,
ADD COLUMN     "keys_location" TEXT,
ADD COLUMN     "keys_notes" TEXT,
ADD COLUMN     "keys_received_at" TIMESTAMP(3),
ADD COLUMN     "keys_received_by_id" TEXT;

-- CreateTable
CREATE TABLE "vehicle_document_requirement_dispositions" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "category" "VehicleDocumentCategory" NOT NULL,
    "disposition" "DocumentRequirementDisposition" NOT NULL,
    "notes" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_document_requirement_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_document_requirement_dispositions_vehicle_id_catego_key" ON "vehicle_document_requirement_dispositions"("vehicle_id", "category");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_entry_validated_by_id_fkey" FOREIGN KEY ("entry_validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_entry_annulled_by_id_fkey" FOREIGN KEY ("entry_annulled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_keys_received_by_id_fkey" FOREIGN KEY ("keys_received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_document_requirement_dispositions" ADD CONSTRAINT "vehicle_document_requirement_dispositions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_document_requirement_dispositions" ADD CONSTRAINT "vehicle_document_requirement_dispositions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EnableRowLevelSecurity
-- Personalización manual (Prisma no la genera). Invariante del repositorio: TODA tabla de
-- `public` debe tener RLS activada (deny-all para anon/authenticated; Prisma accede con un rol
-- BYPASSRLS). Sin esta línea, `pnpm check:rls` falla y el conteo `tables_without_rls` deja de ser 0.
ALTER TABLE "vehicle_document_requirement_dispositions" ENABLE ROW LEVEL SECURITY;
