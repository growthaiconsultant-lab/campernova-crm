-- CreateEnum
CREATE TYPE "VehicleCostCategory" AS ENUM ('PIEZAS', 'MANO_OBRA_TALLER', 'INSTALACION', 'LIMPIEZA', 'MARKETING', 'CUSTODIA', 'POSTVENTA', 'OTRO');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO', 'COMPLETADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "WorkOrderApprovalLevel" AS ENUM ('NO_REQUIERE', 'REQUIERE_CEO', 'APROBADA_CEO', 'RECHAZADA_CEO');

-- CreateEnum
CREATE TYPE "ChecklistItemCategory" AS ENUM ('MECANICA', 'CAMPER', 'ELECTRICIDAD');

-- CreateEnum
CREATE TYPE "ChecklistItemResult" AS ENUM ('PENDIENTE', 'OK', 'NECESITA_REPARACION', 'NO_APLICA');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'COSTE_IMPUTADO';
ALTER TYPE "ActivityType" ADD VALUE 'ORDEN_TALLER_CREADA';
ALTER TYPE "ActivityType" ADD VALUE 'ORDEN_TALLER_COMPLETADA';
ALTER TYPE "ActivityType" ADD VALUE 'ORDEN_TALLER_APROBADA';
ALTER TYPE "ActivityType" ADD VALUE 'ORDEN_TALLER_RECHAZADA';
ALTER TYPE "ActivityType" ADD VALUE 'PRECIO_VENTA_AJUSTADO';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "entry_date" TIMESTAMP(3),
ADD COLUMN "margin_percent" DECIMAL(5,2) NOT NULL DEFAULT 4.0,
ADD COLUMN "nave_location" TEXT,
ADD COLUMN "purchase_price" DECIMAL(10,2),
ADD COLUMN "sale_price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "vehicle_costs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "category" "VehicleCostCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "supplier" TEXT,
    "invoice_url" TEXT,
    "created_by_id" TEXT,
    "work_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDIENTE',
    "description" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "estimated_hours" DECIMAL(6,2),
    "estimated_cost" DECIMAL(10,2),
    "approval_level" "WorkOrderApprovalLevel" NOT NULL DEFAULT 'NO_REQUIERE',
    "approval_limit" DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_checklist" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "category" "ChecklistItemCategory" NOT NULL,
    "item" TEXT NOT NULL,
    "result" "ChecklistItemResult" NOT NULL DEFAULT 'PENDIENTE',
    "notes" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_order_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_time_entries" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "hourly_rate" DECIMAL(6,2) NOT NULL DEFAULT 30.00,
    "description" TEXT NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_order_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_parts" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "supplier" TEXT,
    "invoice_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_order_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_costs_vehicle_id_category_idx" ON "vehicle_costs"("vehicle_id", "category");
CREATE INDEX "vehicle_costs_work_order_id_idx" ON "vehicle_costs"("work_order_id");
CREATE INDEX "work_orders_vehicle_id_idx" ON "work_orders"("vehicle_id");
CREATE INDEX "work_orders_assigned_to_id_status_idx" ON "work_orders"("assigned_to_id", "status");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");
CREATE INDEX "work_order_checklist_work_order_id_category_idx" ON "work_order_checklist"("work_order_id", "category");
CREATE INDEX "work_order_time_entries_work_order_id_idx" ON "work_order_time_entries"("work_order_id");
CREATE INDEX "work_order_time_entries_worker_id_work_date_idx" ON "work_order_time_entries"("worker_id", "work_date");
CREATE INDEX "work_order_parts_work_order_id_idx" ON "work_order_parts"("work_order_id");

-- AddForeignKey
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_order_checklist" ADD CONSTRAINT "work_order_checklist_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_time_entries" ADD CONSTRAINT "work_order_time_entries_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_time_entries" ADD CONSTRAINT "work_order_time_entries_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
