-- Taxonomía RV (Fase #3 v1): distribución, camas, plazas, baño, peso/carnet, etc.
-- Additivo y NO destructivo: nuevos enums + columnas nullable. No toca datos existentes.

-- Enums
CREATE TYPE "VehicleCategory" AS ENUM ('MINI_CAMPER', 'CAMPER', 'GRAN_VOLUMEN', 'PERFILADA', 'CAPUCHINA', 'INTEGRAL');
CREATE TYPE "BedLayout" AS ENUM ('TRANSVERSAL', 'LONGITUDINAL', 'GEMELAS', 'ISLA', 'FRANCESA', 'BASCULANTE', 'LITERAS', 'TECHO_ELEVABLE', 'DINETTE');
CREATE TYPE "BathroomType" AS ENUM ('NINGUNO', 'HUMEDO', 'SEPARADO');
CREATE TYPE "LicenseType" AS ENUM ('B', 'C1');
CREATE TYPE "HeatingType" AS ENUM ('NINGUNA', 'GAS', 'DIESEL', 'ELECTRICA');

-- Vehicle: taxonomía del stock
ALTER TABLE "vehicles" ADD COLUMN "category" "VehicleCategory";
ALTER TABLE "vehicles" ADD COLUMN "bed_layout" "BedLayout";
ALTER TABLE "vehicles" ADD COLUMN "sleeping_places" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "bathroom_type" "BathroomType";
ALTER TABLE "vehicles" ADD COLUMN "heating_type" "HeatingType";
ALTER TABLE "vehicles" ADD COLUMN "winterized" BOOLEAN;
ALTER TABLE "vehicles" ADD COLUMN "has_garage" BOOLEAN;
ALTER TABLE "vehicles" ADD COLUMN "max_mass_kg" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "height_m" DOUBLE PRECISION;
ALTER TABLE "vehicles" ADD COLUMN "off_grid" BOOLEAN;

-- BuyerLead: preferencias del comprador
ALTER TABLE "buyer_leads" ADD COLUMN "preferred_category" "VehicleCategory";
ALTER TABLE "buyer_leads" ADD COLUMN "preferred_bed_layout" "BedLayout";
ALTER TABLE "buyer_leads" ADD COLUMN "sleeping_places_required" INTEGER;
ALTER TABLE "buyer_leads" ADD COLUMN "bathroom_required" BOOLEAN;
ALTER TABLE "buyer_leads" ADD COLUMN "license_type" "LicenseType";
ALTER TABLE "buyer_leads" ADD COLUMN "needs_winter" BOOLEAN;
ALTER TABLE "buyer_leads" ADD COLUMN "needs_garage" BOOLEAN;
ALTER TABLE "buyer_leads" ADD COLUMN "max_length_m" DOUBLE PRECISION;
ALTER TABLE "buyer_leads" ADD COLUMN "max_height_m" DOUBLE PRECISION;
ALTER TABLE "buyer_leads" ADD COLUMN "has_kids" BOOLEAN;
