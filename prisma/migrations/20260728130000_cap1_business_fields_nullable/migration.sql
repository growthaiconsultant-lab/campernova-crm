-- CAP-1 — Captación progresiva: ningún campo de NEGOCIO es obligatorio al crear/editar un candidato
-- VENDEDOR (SellerLead), un vehículo (Vehicle) o una captación de portal (VehicleCapture) en el CRM
-- interno. (BuyerLead queda FUERA de alcance: su contacto sigue siendo obligatorio — ver doc CAP-1.)
--
-- Backward-compatible nullable-relaxation migration; DROP NOT NULL only; no DML, no backfill and no
-- destructive data operation. `DROP NOT NULL` AMPLÍA el dominio (permite null) sin tocar los datos
-- existentes (las filas actuales conservan sus valores). Los identificadores técnicos (id, FKs,
-- timestamps) NO se tocan. Los gates operativos (A2 entrada, A3 tasación oficial, publicación) siguen
-- exigiendo sus requisitos en el hito, no en la captación.
--
-- Compatibilidad de rollout: old code + new schema = compatible (el código viejo siempre aporta
-- valores; nunca inserta null). new code + old schema = incompatible (inserta null en columnas aún
-- NOT NULL) → aplicar la migración ANTES de desplegar el cliente CAP-1. (No se aplica en este encargo.)

-- SellerLead
ALTER TABLE "seller_leads" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "seller_leads" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "seller_leads" ALTER COLUMN "phone" DROP NOT NULL;

-- Vehicle
ALTER TABLE "vehicles" ALTER COLUMN "brand" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "model" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "year" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "km" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "seats" DROP NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "type" DROP NOT NULL;

-- VehicleCapture
ALTER TABLE "vehicle_captures" ALTER COLUMN "listing_url" DROP NOT NULL;
ALTER TABLE "vehicle_captures" ALTER COLUMN "phone" DROP NOT NULL;
