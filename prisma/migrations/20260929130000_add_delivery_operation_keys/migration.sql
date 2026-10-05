BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "deliveries" ADD COLUMN "creation_key" TEXT, ADD COLUMN "creation_fingerprint" TEXT;
CREATE UNIQUE INDEX "deliveries_creation_key_key" ON "deliveries"("creation_key");
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_operation_key_check"
CHECK ((creation_key IS NULL) = (creation_fingerprint IS NULL));
COMMIT;
