-- PUB-1 — Categorías de foto + traza de despublicación.
--
-- Aditiva y NO destructiva: un enum nuevo (PhotoCategory), una columna nullable
-- (vehicle_photos.category) y un valor additive en ActivityType. Sin DML, sin backfill, sin drops.
-- Las fotos existentes quedan con category = NULL. El valor PUBLICACION_RETIRADA se emite en runtime
-- (nunca dentro de esta migración), por lo que no choca con la restricción de Postgres de no usar un
-- valor de enum recién añadido en la misma transacción.

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('EXTERIOR', 'INTERIOR', 'DETALLE', 'DOCUMENTAL');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'PUBLICACION_RETIRADA';

-- AlterTable
ALTER TABLE "vehicle_photos" ADD COLUMN "category" "PhotoCategory";
