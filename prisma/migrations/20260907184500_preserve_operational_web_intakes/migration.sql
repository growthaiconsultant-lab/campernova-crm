-- INTAKE-1: corrección aditiva del backfill tras el preflight de producción.
-- Una solicitud web con historial operativo nunca debe volver a la bandeja de pendientes.
UPDATE "seller_leads" AS s
SET
  "intake_status" = 'ADMITIDO',
  "intake_reviewed_at" = NULL,
  "intake_reviewed_by_id" = NULL
FROM "vehicles" AS v
WHERE v."seller_lead_id" = s."id"
  AND s."intake_status" = 'PENDIENTE'
  AND (
    s."status" <> 'NUEVO'
    OR s."agent_id" IS NOT NULL
    OR v."status" <> 'NUEVO'
    OR v."entry_validated_at" IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM "offers" AS o
      WHERE o."vehicle_id" = v."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "deliveries" AS d
      WHERE d."vehicle_id" = v."id"
    )
  );
