-- Planificación de capacidad del taller: ventana de trabajo reservada en la agenda.
-- Additivo y no destructivo: columnas nullable + índice para consultas de agenda por mecánico.
ALTER TABLE "work_orders" ADD COLUMN "scheduled_start" TIMESTAMP(3);
ALTER TABLE "work_orders" ADD COLUMN "scheduled_end" TIMESTAMP(3);

CREATE INDEX "work_orders_assigned_to_id_scheduled_start_idx" ON "work_orders"("assigned_to_id", "scheduled_start");
