-- INTAKE-1: cuestionario progresivo de recepción por vehículo.
-- Migración estrictamente aditiva: no modifica ni backfillea filas existentes.

CREATE TYPE "CamperizationState" AS ENUM ('CAMPERIZADO', 'SIN_CAMPERIZAR');
CREATE TYPE "ReceptionTransmission" AS ENUM ('MANUAL', 'AUTOMATICA');
CREATE TYPE "ReceptionDrivetrain" AS ENUM ('DELANTERA', 'TRASERA', 'CUATRO_POR_CUATRO');
CREATE TYPE "ReceptionFuelType" AS ENUM ('DIESEL', 'GASOLINA', 'HIBRIDO', 'ELECTRICO');
CREATE TYPE "ReceptionAccessStepType" AS ENUM ('MANUAL', 'ELECTRICO', 'NINGUNO');
CREATE TYPE "ReceptionLiftBedType" AS ENUM ('ELECTRICA', 'MANUAL', 'NINGUNA');
CREATE TYPE "ReceptionSwivelSeats" AS ENUM ('CONDUCTOR', 'PASAJERO', 'AMBOS', 'NINGUNO');
CREATE TYPE "ReceptionDiningTableType" AS ENUM ('FIJA', 'PLEGABLE', 'EXTRAIBLE');
CREATE TYPE "ReceptionCabBlackoutType" AS ENUM ('REMIS', 'AISLANTE_NUEVE_CAPAS', 'NINGUNO');
CREATE TYPE "ReceptionFridgeType" AS ENUM ('COMPRESOR', 'ABSORCION_TRIVALENTE', 'NINGUNA');
CREATE TYPE "ReceptionAuxBatteryType" AS ENUM ('GEL_AGM', 'LITIO', 'OTRA', 'NINGUNA');
CREATE TYPE "ReceptionElectricalSystem" AS ENUM ('V12', 'V220', 'AMBOS');
CREATE TYPE "ReceptionLivingAirConditioning" AS ENUM ('V12', 'V230', 'NINGUNO');

ALTER TABLE "vehicles"
  ADD COLUMN "camperization_state" "CamperizationState";

CREATE TABLE "vehicle_reception_questionnaires" (
  "id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "reception_date" DATE,
  "previous_owners" INTEGER,
  "maintenance_history_available" BOOLEAN,
  "sale_reason" TEXT,
  "last_service_date" DATE,
  "model_version" TEXT,
  "engine" TEXT,
  "power_cv" INTEGER,
  "transmission" "ReceptionTransmission",
  "drivetrain" "ReceptionDrivetrain",
  "fuel_type" "ReceptionFuelType",
  "external_damage_notes" TEXT,
  "internal_damage_notes" TEXT,
  "skylight_count" INTEGER,
  "window_count" INTEGER,
  "has_side_awning" BOOLEAN,
  "has_bike_rack" BOOLEAN,
  "access_step_type" "ReceptionAccessStepType",
  "has_outdoor_shower" BOOLEAN,
  "lift_bed_type" "ReceptionLiftBedType",
  "has_bunk_beds" BOOLEAN,
  "exterior_connections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "swivel_seats" "ReceptionSwivelSeats",
  "dining_table_type" "ReceptionDiningTableType",
  "has_interior_led" BOOLEAN,
  "cab_blackout_type" "ReceptionCabBlackoutType",
  "has_multimedia_tv" BOOLEAN,
  "fridge_type" "ReceptionFridgeType",
  "kitchen_power_sources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "has_sink" BOOLEAN,
  "has_full_bathroom" BOOLEAN,
  "has_removable_cassette_toilet" BOOLEAN,
  "fresh_water_liters" INTEGER,
  "grey_water_liters" INTEGER,
  "water_heater_sources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "heating_sources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aux_battery_type" "ReceptionAuxBatteryType",
  "aux_battery_capacity_ah" INTEGER,
  "electrical_system" "ReceptionElectricalSystem",
  "has_solar_panel" BOOLEAN,
  "solar_power_w" INTEGER,
  "solar_regulator_power_w" INTEGER,
  "has_inverter" BOOLEAN,
  "has_external_230v_connection" BOOLEAN,
  "interior_sockets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "has_cab_air_conditioning" BOOLEAN,
  "living_air_conditioning" "ReceptionLivingAirConditioning",
  "has_fans_extractors" BOOLEAN,
  "has_camperization_homologation" BOOLEAN,
  "has_maintenance_book" BOOLEAN,
  "declared_keys_count" INTEGER,
  "included_accessories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accessories_other" TEXT,
  "extras_notes" TEXT,
  "additional_observations" TEXT,
  "commercial_revision" INTEGER NOT NULL DEFAULT 0,
  "technical_revision" INTEGER NOT NULL DEFAULT 0,
  "commercial_reviewed_revision" INTEGER,
  "technical_reviewed_revision" INTEGER,
  "commercial_reviewed_at" TIMESTAMP(3),
  "commercial_reviewed_by_id" TEXT,
  "technical_reviewed_at" TIMESTAMP(3),
  "technical_reviewed_by_id" TEXT,
  "completed_at" TIMESTAMP(3),
  "completed_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vehicle_reception_questionnaires_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_reception_previous_owners_check"
    CHECK ("previous_owners" IS NULL OR "previous_owners" BETWEEN 0 AND 100),
  CONSTRAINT "vehicle_reception_power_cv_check"
    CHECK ("power_cv" IS NULL OR "power_cv" BETWEEN 1 AND 1500),
  CONSTRAINT "vehicle_reception_skylight_count_check"
    CHECK ("skylight_count" IS NULL OR "skylight_count" BETWEEN 0 AND 50),
  CONSTRAINT "vehicle_reception_window_count_check"
    CHECK ("window_count" IS NULL OR "window_count" BETWEEN 0 AND 100),
  CONSTRAINT "vehicle_reception_water_liters_check"
    CHECK (("fresh_water_liters" IS NULL OR "fresh_water_liters" BETWEEN 0 AND 5000)
       AND ("grey_water_liters" IS NULL OR "grey_water_liters" BETWEEN 0 AND 5000)),
  CONSTRAINT "vehicle_reception_battery_capacity_check"
    CHECK ("aux_battery_capacity_ah" IS NULL OR "aux_battery_capacity_ah" BETWEEN 0 AND 5000),
  CONSTRAINT "vehicle_reception_solar_power_check"
    CHECK (("solar_power_w" IS NULL OR "solar_power_w" BETWEEN 0 AND 10000)
       AND ("solar_regulator_power_w" IS NULL OR "solar_regulator_power_w" BETWEEN 0 AND 10000)),
  CONSTRAINT "vehicle_reception_declared_keys_check"
    CHECK ("declared_keys_count" IS NULL OR "declared_keys_count" BETWEEN 0 AND 10),
  CONSTRAINT "vehicle_reception_revisions_check"
    CHECK ("commercial_revision" >= 0 AND "technical_revision" >= 0
       AND ("commercial_reviewed_revision" IS NULL OR "commercial_reviewed_revision" <= "commercial_revision")
       AND ("technical_reviewed_revision" IS NULL OR "technical_reviewed_revision" <= "technical_revision")),
  -- El actor puede quedar NULL por ON DELETE SET NULL sin perder la fecha histórica de cierre.
  CONSTRAINT "vehicle_reception_completion_actor_check"
    CHECK ("completed_by_id" IS NULL OR "completed_at" IS NOT NULL),
  CONSTRAINT "vehicle_reception_exterior_connections_check"
    CHECK ("exterior_connections" <@ ARRAY['V220', 'AGUA']::TEXT[]),
  CONSTRAINT "vehicle_reception_kitchen_sources_check"
    CHECK ("kitchen_power_sources" <@ ARRAY['GAS', 'ELECTRICA']::TEXT[]),
  CONSTRAINT "vehicle_reception_water_heater_sources_check"
    CHECK ("water_heater_sources" <@ ARRAY['GAS', 'ELECTRICA', 'DIESEL']::TEXT[]),
  CONSTRAINT "vehicle_reception_heating_sources_check"
    CHECK ("heating_sources" <@ ARRAY['GAS', 'ELECTRICA', 'DIESEL']::TEXT[]),
  CONSTRAINT "vehicle_reception_interior_sockets_check"
    CHECK ("interior_sockets" <@ ARRAY['USB', 'V12', 'V220']::TEXT[]),
  CONSTRAINT "vehicle_reception_accessories_check"
    CHECK ("included_accessories" <@ ARRAY['MESA_EXTERIOR', 'SILLAS', 'AVANCE', 'CUNAS', 'OTROS']::TEXT[])
);

CREATE UNIQUE INDEX "vehicle_reception_questionnaires_vehicle_id_key"
  ON "vehicle_reception_questionnaires"("vehicle_id");

ALTER TABLE "vehicle_reception_questionnaires"
  ADD CONSTRAINT "vehicle_reception_questionnaires_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_reception_questionnaires"
  ADD CONSTRAINT "vehicle_reception_questionnaires_commercial_reviewed_by_id_fkey"
  FOREIGN KEY ("commercial_reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vehicle_reception_questionnaires"
  ADD CONSTRAINT "vehicle_reception_questionnaires_technical_reviewed_by_id_fkey"
  FOREIGN KEY ("technical_reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vehicle_reception_questionnaires"
  ADD CONSTRAINT "vehicle_reception_questionnaires_completed_by_id_fkey"
  FOREIGN KEY ("completed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Las tablas de aplicación no son accesibles directamente desde el navegador. RLS queda habilitado
-- sin políticas, como en el resto del esquema gestionado por Prisma, y el servidor autoriza antes.
ALTER TABLE "vehicle_reception_questionnaires" ENABLE ROW LEVEL SECURITY;
