CREATE TYPE "OwnerQuoteStatus" AS ENUM ('BORRADOR', 'EN_ENVIO', 'PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'SUSTITUIDO');

CREATE TABLE "inspection_owner_quotes" (
  "id" TEXT PRIMARY KEY,
  "work_order_id" TEXT NOT NULL REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" "OwnerQuoteStatus" NOT NULL DEFAULT 'BORRADOR',
  "lines" JSONB NOT NULL,
  "owner_name" TEXT,
  "owner_email" TEXT,
  "vehicle_label" TEXT,
  "sent_at" TIMESTAMP(3),
  "answered_at" TIMESTAMP(3),
  "reason" TEXT
);
CREATE UNIQUE INDEX "inspection_owner_quotes_work_order_id_version_key" ON "inspection_owner_quotes" ("work_order_id", "version");
ALTER TABLE "inspection_owner_quotes" ENABLE ROW LEVEL SECURITY;
