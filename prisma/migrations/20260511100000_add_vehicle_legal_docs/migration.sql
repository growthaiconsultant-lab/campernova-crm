-- CreateEnum
CREATE TYPE "VehicleDocumentCategory" AS ENUM ('DNI_VENDEDOR', 'CONTRATO_COMPRAVENTA', 'FICHA_TECNICA', 'PERMISO_CIRCULACION', 'ITV_VIGENTE', 'JUSTIFICANTE_PAGO', 'INFORME_CARGAS_DGT', 'LIBRO_MANTENIMIENTO', 'FACTURA_COMPRA_ORIGINAL', 'CONTRATO_FINAL_VENTA', 'OTRO');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'DOCUMENTO_SUBIDO';
ALTER TYPE "ActivityType" ADD VALUE 'DOCUMENTO_ELIMINADO';
ALTER TYPE "ActivityType" ADD VALUE 'MATRICULA_AÑADIDA';
ALTER TYPE "ActivityType" ADD VALUE 'ITV_ACTUALIZADA';
ALTER TYPE "ActivityType" ADD VALUE 'CARGAS_VERIFICADAS';
ALTER TYPE "ActivityType" ADD VALUE 'TITULARIDAD_TRANSFERIDA';
ALTER TYPE "ActivityType" ADD VALUE 'PUBLICACION_BLOQUEADA';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "charge_checked_at" TIMESTAMP(3),
ADD COLUMN     "charge_checked_by_id" TEXT,
ADD COLUMN     "itv_valid_until" TIMESTAMP(3),
ADD COLUMN     "plate" TEXT,
ADD COLUMN     "title_transferred_at" TIMESTAMP(3),
ADD COLUMN     "vin" TEXT;

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "category" "VehicleDocumentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "notes" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicle_id_category_idx" ON "vehicle_documents"("vehicle_id", "category");

-- CreateIndex
CREATE INDEX "vehicles_plate_idx" ON "vehicles"("plate");

-- CreateIndex
CREATE INDEX "vehicles_vin_idx" ON "vehicles"("vin");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_charge_checked_by_id_fkey" FOREIGN KEY ("charge_checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
