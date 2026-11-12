ALTER TABLE "users" ADD COLUMN "entry_inspection_coordinator" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "users_one_entry_inspection_coordinator" ON "users" ("entry_inspection_coordinator")
WHERE "entry_inspection_coordinator";
WITH candidates AS (
  SELECT id FROM "users" WHERE lower(trim(name)) = 'nerea' AND active AND role IN ('ADMIN', 'TALLER')
)
UPDATE "users" SET "entry_inspection_coordinator" = true
WHERE id IN (SELECT id FROM candidates) AND (SELECT count(*) FROM candidates) = 1;

ALTER TABLE "work_order_checklist"
  ADD COLUMN "installed" BOOLEAN,
  ADD COLUMN "owner_quote" BOOLEAN NOT NULL DEFAULT false;
