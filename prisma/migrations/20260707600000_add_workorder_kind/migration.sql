-- F4: naturaleza de la orden de taller (reparación vs mejora), aditivo

-- CreateEnum
CREATE TYPE "WorkOrderKind" AS ENUM ('REPARACION', 'MEJORA');

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN "kind" "WorkOrderKind" NOT NULL DEFAULT 'REPARACION';
