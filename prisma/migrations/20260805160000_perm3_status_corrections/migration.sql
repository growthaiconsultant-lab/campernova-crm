-- PERM-3: enlaza cada coste de postventa con su ticket de origen y evita
-- duplicar los costes agregados generados al completar una orden de taller.

-- Stop conditions fail-closed: estos casos necesitan reconciliación explícita antes del rollout.
-- No se intenta deducir ni modificar datos históricos dentro de una migración de schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "vehicle_costs"
    WHERE "work_order_id" IS NOT NULL
    GROUP BY "work_order_id", "category"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PERM3_PREFLIGHT_DUPLICATE_WORK_ORDER_COSTS';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "vehicle_costs" WHERE "category" = 'POSTVENTA'
  ) THEN
    RAISE EXCEPTION 'PERM3_PREFLIGHT_UNLINKED_POSTVENTA_COSTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "postventa_tickets"
    WHERE "status" = 'CERRADO' AND "cost_real" > 0
  ) THEN
    RAISE EXCEPTION 'PERM3_PREFLIGHT_CLOSED_TICKETS_WITH_COST';
  END IF;
END $$;

ALTER TABLE "vehicle_costs"
  ADD COLUMN "postventa_ticket_id" TEXT;

CREATE UNIQUE INDEX "vehicle_costs_postventa_ticket_id_key"
  ON "vehicle_costs"("postventa_ticket_id");

CREATE UNIQUE INDEX "vehicle_costs_work_order_id_category_key"
  ON "vehicle_costs"("work_order_id", "category");

ALTER TABLE "vehicle_costs"
  ADD CONSTRAINT "vehicle_costs_postventa_ticket_id_fkey"
  FOREIGN KEY ("postventa_ticket_id") REFERENCES "postventa_tickets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
