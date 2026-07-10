-- Baseline (squash) del historial de migraciones — reemplaza las 26 migraciones
-- anteriores por una única migración reproducible desde una base de datos VACÍA.
--
-- Motivo: el historial anterior no era aplicable desde cero porque dos carpetas
-- compartían prefijo de timestamp y `20260502000000_add_gdpr_consent_to_seller_leads`
-- ordenaba ANTES que `20260502000000_init_schema`, intentando ALTER de `seller_leads`
-- antes de que la tabla existiera (P3018 / 42P01). El historial anterior se conserva
-- en Git en el commit 5ce93d6 y NO debe restaurarse dentro del directorio activo.
--
-- Parte 1 — Estructura: generada con
--   `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
--   (Prisma 6.19.3). Representa EXACTAMENTE `prisma/schema.prisma` (sin cambios de datamodel).
-- Parte 2 — SQL personalizado (RLS): reincorporado manualmente al final (ver abajo),
--   equivalente al efecto acumulado de las migraciones históricas de RLS
--   (`20260603000000_enable_rls_deny_all_public` + `20260712000000_enable_rls_new_public_tables`).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENTE', 'TALLER', 'ENTREGAS', 'MARKETING');

-- CreateEnum
CREATE TYPE "LeadCanal" AS ENUM ('PRO', 'CN');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAMPER', 'AUTOCARAVANA');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('MINI_CAMPER', 'CAMPER', 'GRAN_VOLUMEN', 'PERFILADA', 'CAPUCHINA', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "BedLayout" AS ENUM ('TRANSVERSAL', 'LONGITUDINAL', 'GEMELAS', 'ISLA', 'FRANCESA', 'BASCULANTE', 'LITERAS', 'TECHO_ELEVABLE', 'DINETTE');

-- CreateEnum
CREATE TYPE "BathroomType" AS ENUM ('NINGUNO', 'HUMEDO', 'SEPARADO');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('B', 'C1');

-- CreateEnum
CREATE TYPE "HeatingType" AS ENUM ('NINGUNA', 'GAS', 'DIESEL', 'ELECTRICA');

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
CREATE TYPE "OfferStatus" AS ENUM ('PROPUESTA', 'CONTRAOFERTA', 'ACEPTADA', 'CONVERTIDA', 'RECHAZADA', 'EXPIRADA', 'RETIRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CAMBIO_ESTADO', 'NOTA', 'LLAMADA', 'EMAIL', 'WHATSAPP_INICIADO', 'MATCH_CREADO', 'LEAD_ASIGNADO', 'LEAD_CREADO_CHAT', 'ANUNCIO_GENERADO', 'FOTOS_DESCARGADAS', 'COSTE_IMPUTADO', 'ORDEN_TALLER_CREADA', 'ORDEN_TALLER_COMPLETADA', 'ORDEN_TALLER_APROBADA', 'ORDEN_TALLER_RECHAZADA', 'PRECIO_VENTA_AJUSTADO', 'ENTREGA_PROGRAMADA', 'ENTREGA_COMPLETADA', 'ENTREGA_CANCELADA', 'GARANTIA_ACTIVADA', 'GARANTIA_AMPLIADA', 'TICKET_POSTVENTA_ABIERTO', 'TICKET_POSTVENTA_RESUELTO', 'TICKET_POSTVENTA_CERRADO', 'FOLLOWUP_ENVIADO', 'FOLLOWUP_RESPONDIDO', 'DOCUMENTO_SUBIDO', 'DOCUMENTO_ELIMINADO', 'MATRICULA_AÑADIDA', 'ITV_ACTUALIZADA', 'CARGAS_VERIFICADAS', 'TITULARIDAD_TRANSFERIDA', 'PUBLICACION_BLOQUEADA', 'PROXIMA_ACCION_ACTUALIZADA', 'TEMPERATURA_ACTUALIZADA', 'OFERTA_REGISTRADA', 'OFERTA_ACTUALIZADA', 'TRUST_SELLO_OTORGADO', 'TRUST_SELLO_REVOCADO');

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "TradeInVehicleType" AS ENUM ('COCHE', 'CAMPER', 'AUTOCARAVANA', 'FURGONETA', 'MOTO', 'OTRO');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('PRECIO', 'FINANCIACION', 'COMPRO_A_OTRO', 'NO_RESPONDE', 'APLAZA', 'SIN_STOCK', 'EXPECTATIVAS', 'OTRO');

-- CreateEnum
CREATE TYPE "SellerDealType" AS ENUM ('DEPOSITO_VENTA', 'COMPRA_DIRECTA', 'PARTE_PAGO', 'INDECISO');

-- CreateEnum
CREATE TYPE "SellerUrgency" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "SellerRisk" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "CapturePortal" AS ENUM ('COCHES_NET', 'WALLAPOP', 'MILANUNCIOS', 'OTRO');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('NO_CONTACTADO', 'CONTACTADO', 'EN_CURSO', 'ENTRADA_AGENDADA', 'CONVERTIDO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "NextActionType" AS ENUM ('LLAMAR', 'WHATSAPP', 'EMAIL', 'ENVIAR_VEHICULOS', 'PEDIR_DOCS', 'AGENDAR_VISITA', 'SEGUIMIENTO', 'CERRAR');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CITA', 'LLAMADA', 'LIMPIEZA', 'SEGUIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('PROGRAMADO', 'CONFIRMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CalendarEventPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "VehicleDocumentCategory" AS ENUM ('DNI_VENDEDOR', 'CONTRATO_COMPRAVENTA', 'FICHA_TECNICA', 'PERMISO_CIRCULACION', 'ITV_VIGENTE', 'JUSTIFICANTE_PAGO', 'INFORME_CARGAS_DGT', 'LIBRO_MANTENIMIENTO', 'FACTURA_COMPRA_ORIGINAL', 'CONTRATO_FINAL_VENTA', 'OTRO');

-- CreateEnum
CREATE TYPE "VehicleCostCategory" AS ENUM ('PIEZAS', 'MANO_OBRA_TALLER', 'INSTALACION', 'LIMPIEZA', 'MARKETING', 'CUSTODIA', 'POSTVENTA', 'OTRO');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDIENTE', 'EN_DIAGNOSTICO', 'PRESUPUESTADA', 'EN_CURSO', 'COMPLETADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "WorkOrderKind" AS ENUM ('REPARACION', 'MEJORA');

-- CreateEnum
CREATE TYPE "WorkOrderApprovalLevel" AS ENUM ('NO_REQUIERE', 'REQUIERE_CEO', 'APROBADA_CEO', 'RECHAZADA_CEO');

-- CreateEnum
CREATE TYPE "ChecklistItemCategory" AS ENUM ('MECANICA', 'CAMPER', 'ELECTRICIDAD');

-- CreateEnum
CREATE TYPE "ChecklistItemResult" AS ENUM ('PENDIENTE', 'OK', 'NECESITA_REPARACION', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "AdChannel" AS ENUM ('WALLAPOP', 'COCHESNET');

-- CreateEnum
CREATE TYPE "BuyerChatStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'REDIRECTED_SELLER');

-- CreateEnum
CREATE TYPE "ValuationMethod" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ValuationConfidence" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'FICHA_TECNICA', 'ITV', 'CONTRATO', 'OTROS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DeliveryChecklistCategory" AS ENUM ('PRE_ENTREGA', 'EXPLICACION', 'FIRMA_SALIDA');

-- CreateEnum
CREATE TYPE "DeliveryChecklistResult" AS ENUM ('PENDIENTE', 'OK', 'INCIDENCIA', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "DeliveryDocumentCategory" AS ENUM ('CONTRATO_FINAL', 'FACTURA', 'DOCUMENTO_ENTREGA', 'FOTO_ENTREGA', 'OTRO');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ABIERTO', 'EN_PROGRESO', 'RESUELTO', 'CERRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TicketPhotoType" AS ENUM ('PROBLEMA', 'SOLUCION');

-- CreateEnum
CREATE TYPE "FollowupType" AS ENUM ('DIA_7', 'DIA_30');

-- CreateEnum
CREATE TYPE "FollowupStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'RESPONDIDO', 'FALLIDO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENTE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_new_lead" BOOLEAN NOT NULL DEFAULT true,
    "last_match_email_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "actor_user_id" TEXT,
    "source" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_events_pkey" PRIMARY KEY ("id")
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
    "next_action_type" "NextActionType",
    "next_action_due_at" TIMESTAMP(3),
    "lost_reason" "LostReason",
    "lost_reason_notes" TEXT,
    "min_price" DECIMAL(10,2),
    "deal_type" "SellerDealType",
    "urgency" "SellerUrgency",
    "risk_level" "SellerRisk",
    "risk_notes" TEXT,
    "gdpr_consent_at" TIMESTAMP(3),
    "gdpr_consent_ip" TEXT,
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
    "category" "VehicleCategory",
    "bed_layout" "BedLayout",
    "sleeping_places" INTEGER,
    "bathroom_type" "BathroomType",
    "heating_type" "HeatingType",
    "winterized" BOOLEAN,
    "has_garage" BOOLEAN,
    "max_mass_kg" INTEGER,
    "height_m" DOUBLE PRECISION,
    "off_grid" BOOLEAN,
    "equipment" JSONB NOT NULL DEFAULT '{}',
    "conservation_state" "ConservationState" NOT NULL DEFAULT 'NORMAL',
    "location" TEXT,
    "desired_price" DECIMAL(10,2),
    "valuation_min" DECIMAL(10,2),
    "valuation_recommended" DECIMAL(10,2),
    "valuation_max" DECIMAL(10,2),
    "public_notes" TEXT,
    "purchase_price" DECIMAL(10,2),
    "sale_price" DECIMAL(10,2),
    "margin_percent" DECIMAL(5,2) NOT NULL DEFAULT 4.0,
    "entry_date" TIMESTAMP(3),
    "nave_location" TEXT,
    "plate" TEXT,
    "vin" TEXT,
    "itv_valid_until" TIMESTAMP(3),
    "title_transferred_at" TIMESTAMP(3),
    "charge_checked_at" TIMESTAMP(3),
    "charge_checked_by_id" TEXT,
    "trust_verified_at" TIMESTAMP(3),
    "trust_verified_by_id" TEXT,
    "trust_notes" TEXT,
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
    "financing_needed" BOOLEAN,
    "max_monthly_payment" DECIMAL(10,2),
    "critical_equipment" JSONB NOT NULL DEFAULT '{}',
    "use_zone" TEXT,
    "purchase_timeline" TEXT,
    "preferred_category" "VehicleCategory",
    "preferred_bed_layout" "BedLayout",
    "sleeping_places_required" INTEGER,
    "bathroom_required" BOOLEAN,
    "license_type" "LicenseType",
    "needs_winter" BOOLEAN,
    "needs_garage" BOOLEAN,
    "max_length_m" DOUBLE PRECISION,
    "max_height_m" DOUBLE PRECISION,
    "has_kids" BOOLEAN,
    "status" "BuyerLeadStatus" NOT NULL DEFAULT 'NUEVO',
    "source" TEXT,
    "next_action_type" "NextActionType",
    "next_action_due_at" TIMESTAMP(3),
    "lost_reason" "LostReason",
    "lost_reason_notes" TEXT,
    "temperature" "LeadTemperature",
    "has_trade_in" BOOLEAN,
    "trade_in_type" "TradeInVehicleType",
    "trade_in_brand" TEXT,
    "trade_in_model" TEXT,
    "trade_in_year" INTEGER,
    "trade_in_km" INTEGER,
    "trade_in_finance_pending" BOOLEAN,
    "trade_in_notes" TEXT,
    "trade_in_seller_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_chat_sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "status" "BuyerChatStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "captured_nombre" TEXT,
    "captured_email" TEXT,
    "captured_telefono" TEXT,
    "captured_necesidad" TEXT,
    "captured_plazas" INTEGER,
    "captured_presupuesto_min" INTEGER,
    "captured_presupuesto_max" INTEGER,
    "captured_plazos" TEXT,
    "captured_equipamiento" JSONB,
    "captured_zona" TEXT,
    "gdpr_consent_at" TIMESTAMP(3),
    "gdpr_consent_ip" TEXT,
    "buyer_lead_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "llm_model" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "buyer_chat_sessions_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "buyer_lead_id" TEXT NOT NULL,
    "match_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2),
    "status" "OfferStatus" NOT NULL DEFAULT 'PROPUESTA',
    "reserved_until" TIMESTAMP(3),
    "notes" TEXT,
    "rejection_reason" "LostReason",
    "created_by_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "vehicle_ads" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "channel" "AdChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_ads_pkey" PRIMARY KEY ("id")
);

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
    "kind" "WorkOrderKind" NOT NULL DEFAULT 'REPARACION',
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
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "buyer_lead_id" TEXT NOT NULL,
    "responsable_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "signed_by_name" TEXT,
    "signed_by_dni" TEXT,
    "signature_url" TEXT,
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_checklist_items" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "category" "DeliveryChecklistCategory" NOT NULL,
    "item" TEXT NOT NULL,
    "result" "DeliveryChecklistResult" NOT NULL DEFAULT 'PENDIENTE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_documents" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "category" "DeliveryDocumentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "buyer_lead_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "extended_to" TIMESTAMP(3),
    "extended_at" TIMESTAMP(3),
    "extended_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postventa_tickets" (
    "id" TEXT NOT NULL,
    "warranty_id" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ABIERTO',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIA',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cause" TEXT,
    "solution" TEXT,
    "cost_estimate" DECIMAL(10,2),
    "cost_real" DECIMAL(10,2),
    "responsible_id" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postventa_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postventa_ticket_photos" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "type" "TicketPhotoType" NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postventa_ticket_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postventa_followups" (
    "id" TEXT NOT NULL,
    "warranty_id" TEXT NOT NULL,
    "type" "FollowupType" NOT NULL,
    "status" "FollowupStatus" NOT NULL DEFAULT 'PENDIENTE',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "response_notes" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postventa_followups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "priority" "CalendarEventPriority" NOT NULL DEFAULT 'MEDIA',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "created_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "buyer_lead_id" TEXT,
    "seller_lead_id" TEXT,
    "vehicle_id" TEXT,
    "match_id" TEXT,
    "result_notes" TEXT,
    "internal_notes" TEXT,
    "specific_data" JSONB,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_captures" (
    "id" TEXT NOT NULL,
    "listing_url" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "portal" "CapturePortal" NOT NULL DEFAULT 'OTRO',
    "title" TEXT,
    "asking_price" DECIMAL(10,2),
    "status" "CaptureStatus" NOT NULL DEFAULT 'NO_CONTACTADO',
    "notes" TEXT,
    "rejection_reason" "LostReason",
    "entrada_scheduled_at" TIMESTAMP(3),
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "seller_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "category" "VehicleDocumentCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "notes" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "kpi_events_event_name_occurred_at_idx" ON "kpi_events"("event_name", "occurred_at");

-- CreateIndex
CREATE INDEX "kpi_events_entity_type_entity_id_idx" ON "kpi_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "kpi_events_occurred_at_idx" ON "kpi_events"("occurred_at");

-- CreateIndex
CREATE INDEX "seller_leads_status_idx" ON "seller_leads"("status");

-- CreateIndex
CREATE INDEX "seller_leads_agent_id_idx" ON "seller_leads"("agent_id");

-- CreateIndex
CREATE INDEX "seller_leads_next_action_due_at_idx" ON "seller_leads"("next_action_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_seller_lead_id_key" ON "vehicles"("seller_lead_id");

-- CreateIndex
CREATE INDEX "vehicles_brand_model_idx" ON "vehicles"("brand", "model");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_type_status_idx" ON "vehicles"("type", "status");

-- CreateIndex
CREATE INDEX "vehicles_plate_idx" ON "vehicles"("plate");

-- CreateIndex
CREATE INDEX "vehicles_vin_idx" ON "vehicles"("vin");

-- CreateIndex
CREATE INDEX "vehicle_photos_vehicle_id_order_idx" ON "vehicle_photos"("vehicle_id", "order");

-- CreateIndex
CREATE INDEX "valuations_vehicle_id_idx" ON "valuations"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_leads_trade_in_seller_lead_id_key" ON "buyer_leads"("trade_in_seller_lead_id");

-- CreateIndex
CREATE INDEX "buyer_leads_status_idx" ON "buyer_leads"("status");

-- CreateIndex
CREATE INDEX "buyer_leads_agent_id_idx" ON "buyer_leads"("agent_id");

-- CreateIndex
CREATE INDEX "buyer_leads_next_action_due_at_idx" ON "buyer_leads"("next_action_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_chat_sessions_session_token_key" ON "buyer_chat_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_chat_sessions_buyer_lead_id_key" ON "buyer_chat_sessions"("buyer_lead_id");

-- CreateIndex
CREATE INDEX "buyer_chat_sessions_status_idx" ON "buyer_chat_sessions"("status");

-- CreateIndex
CREATE INDEX "buyer_chat_sessions_started_at_idx" ON "buyer_chat_sessions"("started_at");

-- CreateIndex
CREATE INDEX "matches_buyer_lead_id_idx" ON "matches"("buyer_lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_vehicle_id_buyer_lead_id_key" ON "matches"("vehicle_id", "buyer_lead_id");

-- CreateIndex
CREATE INDEX "offers_vehicle_id_status_idx" ON "offers"("vehicle_id", "status");

-- CreateIndex
CREATE INDEX "offers_buyer_lead_id_status_idx" ON "offers"("buyer_lead_id", "status");

-- CreateIndex
CREATE INDEX "offers_status_idx" ON "offers"("status");

-- CreateIndex
CREATE INDEX "activities_seller_lead_id_created_at_idx" ON "activities"("seller_lead_id", "created_at");

-- CreateIndex
CREATE INDEX "activities_buyer_lead_id_created_at_idx" ON "activities"("buyer_lead_id", "created_at");

-- CreateIndex
CREATE INDEX "vehicle_ads_vehicle_id_channel_created_at_idx" ON "vehicle_ads"("vehicle_id", "channel", "created_at" DESC);

-- CreateIndex
CREATE INDEX "vehicle_costs_vehicle_id_category_idx" ON "vehicle_costs"("vehicle_id", "category");

-- CreateIndex
CREATE INDEX "vehicle_costs_work_order_id_idx" ON "vehicle_costs"("work_order_id");

-- CreateIndex
CREATE INDEX "work_orders_vehicle_id_idx" ON "work_orders"("vehicle_id");

-- CreateIndex
CREATE INDEX "work_orders_assigned_to_id_status_idx" ON "work_orders"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_assigned_to_id_scheduled_start_idx" ON "work_orders"("assigned_to_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "work_order_checklist_work_order_id_category_idx" ON "work_order_checklist"("work_order_id", "category");

-- CreateIndex
CREATE INDEX "work_order_time_entries_work_order_id_idx" ON "work_order_time_entries"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_time_entries_worker_id_work_date_idx" ON "work_order_time_entries"("worker_id", "work_date");

-- CreateIndex
CREATE INDEX "work_order_parts_work_order_id_idx" ON "work_order_parts"("work_order_id");

-- CreateIndex
CREATE INDEX "deliveries_vehicle_id_idx" ON "deliveries"("vehicle_id");

-- CreateIndex
CREATE INDEX "deliveries_buyer_lead_id_idx" ON "deliveries"("buyer_lead_id");

-- CreateIndex
CREATE INDEX "deliveries_responsable_id_status_idx" ON "deliveries"("responsable_id", "status");

-- CreateIndex
CREATE INDEX "deliveries_status_scheduled_at_idx" ON "deliveries"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "delivery_checklist_items_delivery_id_category_idx" ON "delivery_checklist_items"("delivery_id", "category");

-- CreateIndex
CREATE INDEX "delivery_documents_delivery_id_idx" ON "delivery_documents"("delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_vehicle_id_key" ON "warranties"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_delivery_id_key" ON "warranties"("delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_buyer_lead_id_key" ON "warranties"("buyer_lead_id");

-- CreateIndex
CREATE INDEX "warranties_vehicle_id_idx" ON "warranties"("vehicle_id");

-- CreateIndex
CREATE INDEX "warranties_end_date_idx" ON "warranties"("end_date");

-- CreateIndex
CREATE INDEX "postventa_tickets_warranty_id_status_idx" ON "postventa_tickets"("warranty_id", "status");

-- CreateIndex
CREATE INDEX "postventa_tickets_responsible_id_status_idx" ON "postventa_tickets"("responsible_id", "status");

-- CreateIndex
CREATE INDEX "postventa_tickets_status_priority_due_at_idx" ON "postventa_tickets"("status", "priority", "due_at");

-- CreateIndex
CREATE INDEX "postventa_ticket_photos_ticket_id_type_idx" ON "postventa_ticket_photos"("ticket_id", "type");

-- CreateIndex
CREATE INDEX "postventa_followups_status_scheduled_for_idx" ON "postventa_followups"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "postventa_followups_warranty_id_type_key" ON "postventa_followups"("warranty_id", "type");

-- CreateIndex
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");

-- CreateIndex
CREATE INDEX "calendar_events_assigned_to_id_start_at_idx" ON "calendar_events"("assigned_to_id", "start_at");

-- CreateIndex
CREATE INDEX "calendar_events_buyer_lead_id_idx" ON "calendar_events"("buyer_lead_id");

-- CreateIndex
CREATE INDEX "calendar_events_vehicle_id_idx" ON "calendar_events"("vehicle_id");

-- CreateIndex
CREATE INDEX "calendar_events_status_idx" ON "calendar_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_captures_seller_lead_id_key" ON "vehicle_captures"("seller_lead_id");

-- CreateIndex
CREATE INDEX "vehicle_captures_status_idx" ON "vehicle_captures"("status");

-- CreateIndex
CREATE INDEX "vehicle_captures_assigned_to_id_status_idx" ON "vehicle_captures"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "vehicle_captures_entrada_scheduled_at_idx" ON "vehicle_captures"("entrada_scheduled_at");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicle_id_category_idx" ON "vehicle_documents"("vehicle_id", "category");

-- CreateIndex
CREATE INDEX "reference_prices_brand_model_type_idx" ON "reference_prices"("brand", "model", "type");

-- CreateIndex
CREATE UNIQUE INDEX "reference_prices_brand_model_type_base_year_key" ON "reference_prices"("brand", "model", "type", "base_year");

-- AddForeignKey
ALTER TABLE "kpi_events" ADD CONSTRAINT "kpi_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_leads" ADD CONSTRAINT "seller_leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_charge_checked_by_id_fkey" FOREIGN KEY ("charge_checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_trust_verified_by_id_fkey" FOREIGN KEY ("trust_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_leads" ADD CONSTRAINT "buyer_leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_leads" ADD CONSTRAINT "buyer_leads_trade_in_seller_lead_id_fkey" FOREIGN KEY ("trade_in_seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_chat_sessions" ADD CONSTRAINT "buyer_chat_sessions_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "vehicle_ads" ADD CONSTRAINT "vehicle_ads_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ads" ADD CONSTRAINT "vehicle_ads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklist" ADD CONSTRAINT "work_order_checklist_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_time_entries" ADD CONSTRAINT "work_order_time_entries_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_time_entries" ADD CONSTRAINT "work_order_time_entries_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_checklist_items" ADD CONSTRAINT "delivery_checklist_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_documents" ADD CONSTRAINT "delivery_documents_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_documents" ADD CONSTRAINT "delivery_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_extended_by_id_fkey" FOREIGN KEY ("extended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postventa_tickets" ADD CONSTRAINT "postventa_tickets_warranty_id_fkey" FOREIGN KEY ("warranty_id") REFERENCES "warranties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postventa_tickets" ADD CONSTRAINT "postventa_tickets_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postventa_ticket_photos" ADD CONSTRAINT "postventa_ticket_photos_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "postventa_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postventa_ticket_photos" ADD CONSTRAINT "postventa_ticket_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postventa_followups" ADD CONSTRAINT "postventa_followups_warranty_id_fkey" FOREIGN KEY ("warranty_id") REFERENCES "warranties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_captures" ADD CONSTRAINT "vehicle_captures_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_captures" ADD CONSTRAINT "vehicle_captures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_captures" ADD CONSTRAINT "vehicle_captures_seller_lead_id_fkey" FOREIGN KEY ("seller_lead_id") REFERENCES "seller_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- SQL PERSONALIZADO: Row Level Security (no representable en schema.prisma)
-- ─────────────────────────────────────────────────────────────
-- Activa RLS en TODAS las tablas ordinarias del esquema `public` (incluida
-- `_prisma_migrations`, que ya existe cuando corre esta migración). Deja las tablas
-- en modo deny-all para los roles PostgREST (anon/authenticated); Prisma accede con su
-- rol BYPASSRLS. Enfoque idéntico al histórico `20260603000000_enable_rls_deny_all_public`.
--
-- NO crea políticas · NO usa FORCE ROW LEVEL SECURITY · NO cambia grants/roles/ownership
-- · solo actúa sobre tablas ordinarias del esquema `public`. Idempotente y PostgreSQL 17.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
