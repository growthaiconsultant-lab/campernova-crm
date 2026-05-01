-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('AGENTE', 'ADMIN');

-- CreateEnum
CREATE TYPE "LeadCanal" AS ENUM ('PRO', 'CN');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAMPER', 'AUTOCARAVANA');

-- CreateEnum
CREATE TYPE "ConservationState" AS ENUM ('EXCELENTE', 'BUENO', 'NORMAL', 'DETERIORADO');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('NUEVO', 'TASADO', 'PUBLICADO', 'RESERVADO', 'VENDIDO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "SellerLeadStatus" AS ENUM ('NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "BuyerLeadStatus" AS ENUM ('NUEVO', 'CONTACTADO', 'CUALIFICADO', 'EN_NEGOCIACION', 'CERRADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SUGERIDO', 'PROPUESTO_CLIENTE', 'VISITA', 'OFERTA', 'CERRADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CAMBIO_ESTADO', 'NOTA', 'LLAMADA', 'EMAIL', 'WHATSAPP_INICIADO', 'MATCH_CREADO', 'LEAD_ASIGNADO');

-- CreateEnum
CREATE TYPE "ValuationMethod" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ValuationConfidence" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'FICHA_TECNICA', 'ITV', 'CONTRATO', 'OTROS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENTE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "canal" "LeadCanal" NOT NULL DEFAULT 'PRO',
    "status" "SellerLeadStatus" NOT NULL DEFAULT 'NUEVO',
    "source" TEXT,
    "agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "seller_lead_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "length" DOUBLE PRECISION,
    "type" "VehicleType" NOT NULL,
    "equipment" JSONB NOT NULL DEFAULT '{}',
    "conservation_state" "ConservationState" NOT NULL DEFAULT 'NORMAL',
    "location" TEXT,
    "desired_price" DECIMAL(10,2),
    "valuation_min" DECIMAL(10,2),
    "valuation_recommended" DECIMAL(10,2),
    "valuation_max" DECIMAL(10,2),
    "status" "VehicleStatus" NOT NULL DEFAULT 'NUEVO',
    "published_at" TIMESTAMP(3),
    "sold_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "alt_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuations" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "min" DECIMAL(10,2) NOT NULL,
    "recommended" DECIMAL(10,2) NOT NULL,
    "max" DECIMAL(10,2) NOT NULL,
    "method" "ValuationMethod" NOT NULL,
    "confidence" "ValuationConfidence" NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "agent_id" TEXT,
    "vehicle_type" "VehicleType",
    "min_seats" INTEGER,
    "max_budget" DECIMAL(10,2),
    "critical_equipment" JSONB NOT NULL DEFAULT '{}',
    "use_zone" TEXT,
    "purchase_timeline" TEXT,
    "status" "BuyerLeadStatus" NOT NULL DEFAULT 'NUEVO',
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "buyer_lead_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "generated_by" TEXT NOT NULL DEFAULT 'auto',
    "status" "MatchStatus" NOT NULL DEFAULT 'SUGERIDO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "content" TEXT,
    "agent_id" TEXT,
    "seller_lead_id" TEXT,
    "buyer_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "seller_lead_id" TEXT,
    "buyer_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_prices" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "base_year" INTEGER NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "depreciation_per_km" DECIMAL(10,6) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "seller_leads_status_idx" ON "seller_leads"("status");

-- CreateIndex
CREATE INDEX "seller_leads_agent_id_idx" ON "seller_leads"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_seller_lead_id_key" ON "vehicles"("seller_lead_id");

-- CreateIndex
CREATE INDEX "vehicles_brand_model_idx" ON "vehicles"("brand", "model");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_type_status_idx" ON "vehicles"("type", "status");

-- CreateIndex
CREATE INDEX "vehicle_photos_vehicle_id_order_idx" ON "vehicle_photos"("vehicle_id", "order");

-- CreateIndex
CREATE INDEX "valuations_vehicle_id_idx" ON "valuations"("vehicle_id");

-- CreateIndex
CREATE INDEX "buyer_leads_status_idx" ON "buyer_leads"("status");

-- CreateIndex
CREATE INDEX "buyer_leads_agent_id_idx" ON "buyer_leads"("agent_id");

-- CreateIndex
CREATE INDEX "matches_buyer_lead_id_idx" ON "matches"("buyer_lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_vehicle_id_buyer_lead_id_key" ON "matches"("vehicle_id", "buyer_lead_id");

-- CreateIndex
CREATE INDEX "activities_seller_lead_id_created_at_idx" ON "activities"("seller_lead_id", "created_at");

-- CreateIndex
CREATE INDEX "activities_buyer_lead_id_created_at_idx" ON "activities"("buyer_lead_id", "created_at");

-- CreateIndex
CREATE INDEX "reference_prices_brand_model_type_idx" ON "reference_prices"("brand", "model", "type");

-- CreateIndex
CREATE UNIQUE INDEX "reference_prices_brand_model_type_base_year_key" ON "reference_prices"("brand", "model", "type", "base_year");

-- AddForeignKey
ALTER TABLE "seller_leads" ADD CONSTRAINT "seller_leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_leads" ADD CONSTRAINT "buyer_leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

