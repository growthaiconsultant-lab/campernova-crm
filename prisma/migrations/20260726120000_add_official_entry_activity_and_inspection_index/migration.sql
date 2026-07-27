-- PR-A2 — Entrada oficial + endurecimiento del matching.
--
-- Migración ADITIVA (sin DML ni backfill). Añade:
--   · valores nuevos a ActivityType (trazabilidad de entrada/anulación/llaves/orden/disposición y la
--     llegada física — corrección 7.1);
--   · dos columnas nullable en "vehicles" para persistir la llegada física del vehículo (hito previo
--     a la entrada oficial, corrección 7.1) + su FK a "users" (ON DELETE SET NULL, espeja
--     entry_validated_by_id);
--   · el índice único parcial que garantiza «a lo sumo una orden INSPECCION_ENTRADA activa por
--     vehículo» (segunda barrera de la invariante; la primera es el conteo dentro de la transacción).
--
-- No se crean tablas. Las columnas son aditivas y nullable (sin DML ni backfill). No toca la
-- migración A1.

-- AlterEnum
-- Los valores quedan añadidos y se usan desde el writer de A2 (entrada/anulación/disposición/llegada).
-- Se añaden en una migración propia porque PostgreSQL no permite usar un valor de enum nuevo en la
-- misma transacción en que se añade; aquí solo se declaran.
ALTER TYPE "ActivityType" ADD VALUE 'ENTRADA_VALIDADA';
ALTER TYPE "ActivityType" ADD VALUE 'ENTRADA_ANULADA';
ALTER TYPE "ActivityType" ADD VALUE 'LLAVES_REGISTRADAS';
ALTER TYPE "ActivityType" ADD VALUE 'ORDEN_INSPECCION_CREADA';
ALTER TYPE "ActivityType" ADD VALUE 'DISPOSICION_DOCUMENTAL_ACTUALIZADA';
ALTER TYPE "ActivityType" ADD VALUE 'LLEGADA_REGISTRADA';

-- AlterTable
-- Llegada física del vehículo a la nave (corrección 7.1): hito persistido previo a la entrada
-- oficial. Aditivo y nullable → no toca datos existentes. La validación de la entrada exige
-- physical_arrival_at IS NOT NULL, leído bajo el lock de fila del vehículo.
ALTER TABLE "vehicles" ADD COLUMN "physical_arrival_at" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN "physical_arrival_by_id" TEXT;

-- AddForeignKey — espeja entry_validated_by_id (ON DELETE SET NULL: al borrar el usuario, se
-- conserva el hito de llegada sin actor). Sin índice dedicado, igual que entry_validated_by_id.
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_physical_arrival_by_id_fkey"
  FOREIGN KEY ("physical_arrival_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
-- A LO SUMO una orden de inspección de entrada ACTIVA por vehículo. Activa = cualquier estado que
-- NO sea terminal (COMPLETADA/RECHAZADA). El índice parcial permite recrear la orden tras cerrarla o
-- rechazarla, pero impide dos abiertas a la vez. Prisma no expresa índices parciales: vive solo en
-- SQL (documentado con un comentario en schema.prisma, igual que deliveries_active_vehicle_key).
CREATE UNIQUE INDEX "work_orders_active_inspection_key"
  ON "work_orders" ("vehicle_id")
  WHERE "kind" = 'INSPECCION_ENTRADA' AND "status" NOT IN ('COMPLETADA', 'RECHAZADA');
