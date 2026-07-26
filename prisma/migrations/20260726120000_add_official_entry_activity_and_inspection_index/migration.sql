-- PR-A2 — Entrada oficial + endurecimiento del matching.
--
-- Migración ADITIVA (sin DML ni backfill). Añade:
--   · valores nuevos a ActivityType (trazabilidad de entrada/anulación/llaves/orden/disposición);
--   · el índice único parcial que garantiza «a lo sumo una orden INSPECCION_ENTRADA activa por
--     vehículo» (segunda barrera de la invariante; la primera es el conteo dentro de la transacción).
--
-- No se crean tablas ni columnas (se reutilizan las de A1). No toca la migración A1.

-- AlterEnum
-- Los valores quedan añadidos y se usan desde el writer de A2 (entrada/anulación/disposición). Se
-- añaden en una migración propia porque PostgreSQL no permite usar un valor de enum nuevo en la
-- misma transacción en que se añade; aquí solo se declaran.
ALTER TYPE "ActivityType" ADD VALUE 'ENTRADA_VALIDADA';
ALTER TYPE "ActivityType" ADD VALUE 'ENTRADA_ANULADA';
ALTER TYPE "ActivityType" ADD VALUE 'LLAVES_REGISTRADAS';
ALTER TYPE "ActivityType" ADD VALUE 'ORDEN_INSPECCION_CREADA';
ALTER TYPE "ActivityType" ADD VALUE 'DISPOSICION_DOCUMENTAL_ACTUALIZADA';

-- CreateIndex
-- A LO SUMO una orden de inspección de entrada ACTIVA por vehículo. Activa = cualquier estado que
-- NO sea terminal (COMPLETADA/RECHAZADA). El índice parcial permite recrear la orden tras cerrarla o
-- rechazarla, pero impide dos abiertas a la vez. Prisma no expresa índices parciales: vive solo en
-- SQL (documentado con un comentario en schema.prisma, igual que deliveries_active_vehicle_key).
CREATE UNIQUE INDEX "work_orders_active_inspection_key"
  ON "work_orders" ("vehicle_id")
  WHERE "kind" = 'INSPECCION_ENTRADA' AND "status" NOT IN ('COMPLETADA', 'RECHAZADA');
