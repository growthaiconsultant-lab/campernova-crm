-- PR5B1 — Modelo documental versionado (Opción C). Migración ADITIVA: no toca filas legacy,
-- no elimina `url`, no requiere backfill, no accede a Storage.

-- CreateEnum
CREATE TYPE "DocumentVersionStatus" AS ENUM ('ACTIVE', 'REPLACED', 'DELETED');

-- AlterTable
ALTER TABLE "delivery_documents" ADD COLUMN     "current_version_id" TEXT,
ADD COLUMN     "version_sequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vehicle_documents" ADD COLUMN     "current_version_id" TEXT,
ADD COLUMN     "version_sequence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "vehicle_document_id" TEXT,
    "delivery_document_id" TEXT,
    "version" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_path" TEXT NOT NULL,
    "original_filename" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "checksum" TEXT,
    "status" "DocumentVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_object_path_key" ON "document_versions"("object_path");

-- CreateIndex
CREATE INDEX "document_versions_vehicle_document_id_idx" ON "document_versions"("vehicle_document_id");

-- CreateIndex
CREATE INDEX "document_versions_delivery_document_id_idx" ON "document_versions"("delivery_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_vehicle_document_id_version_key" ON "document_versions"("vehicle_document_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_delivery_document_id_version_key" ON "document_versions"("delivery_document_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_vehicle_document_id_id_key" ON "document_versions"("vehicle_document_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_delivery_document_id_id_key" ON "document_versions"("delivery_document_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_documents_id_current_version_id_key" ON "delivery_documents"("id", "current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_documents_id_current_version_id_key" ON "vehicle_documents"("id", "current_version_id");

-- AddForeignKey
ALTER TABLE "delivery_documents" ADD CONSTRAINT "delivery_documents_id_current_version_id_fkey" FOREIGN KEY ("id", "current_version_id") REFERENCES "document_versions"("delivery_document_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_vehicle_document_id_fkey" FOREIGN KEY ("vehicle_document_id") REFERENCES "vehicle_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_delivery_document_id_fkey" FOREIGN KEY ("delivery_document_id") REFERENCES "delivery_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_id_current_version_id_fkey" FOREIGN KEY ("id", "current_version_id") REFERENCES "document_versions"("vehicle_document_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ─────────────────────────────────────────────────────────────────────────────
-- Invariantes NO representables en el schema Prisma (Prisma los ignora en su diff,
-- por lo que no producen drift). Nombres estables y explícitos.
-- ─────────────────────────────────────────────────────────────────────────────

-- Exactamente UNA raíz (vehículo XOR entrega).
ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_exactly_one_root_check"
  CHECK (("vehicle_document_id" IS NOT NULL) <> ("delivery_document_id" IS NOT NULL));

-- Número de versión positivo.
ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_version_positive_check"
  CHECK ("version" > 0);

-- Tamaño no negativo.
ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_size_nonnegative_check"
  CHECK ("size_bytes" IS NULL OR "size_bytes" >= 0);

-- Coherencia estado↔deleted_at: DELETED sii deleted_at está establecido.
ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_deleted_consistency_check"
  CHECK (("status" = 'DELETED') = ("deleted_at" IS NOT NULL));

-- RLS deny-all en la nueva tabla (mismo patrón que el resto: acceso solo vía Prisma/postgres).
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
