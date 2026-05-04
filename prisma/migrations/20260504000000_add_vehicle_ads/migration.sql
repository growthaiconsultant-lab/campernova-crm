-- CreateEnum
CREATE TYPE "AdChannel" AS ENUM ('WALLAPOP', 'COCHESNET');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'ANUNCIO_GENERADO';
ALTER TYPE "ActivityType" ADD VALUE 'FOTOS_DESCARGADAS';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "public_notes" TEXT;

-- CreateTable
CREATE TABLE "vehicle_ads" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "channel" "AdChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_ads_vehicle_id_channel_created_at_idx" ON "vehicle_ads"("vehicle_id", "channel", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "vehicle_ads" ADD CONSTRAINT "vehicle_ads_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ads" ADD CONSTRAINT "vehicle_ads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
