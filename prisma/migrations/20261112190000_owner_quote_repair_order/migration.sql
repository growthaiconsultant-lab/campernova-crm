ALTER TABLE "inspection_owner_quotes" ADD COLUMN "repair_order_id" TEXT;
CREATE UNIQUE INDEX "inspection_owner_quotes_repair_order_id_key" ON "inspection_owner_quotes"("repair_order_id");
ALTER TABLE "inspection_owner_quotes" ADD CONSTRAINT "inspection_owner_quotes_repair_order_id_fkey"
  FOREIGN KEY ("repair_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
