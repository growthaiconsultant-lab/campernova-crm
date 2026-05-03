-- CreateEnum
CREATE TYPE "BuyerChatStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'REDIRECTED_SELLER');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'LEAD_CREADO_CHAT';

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

-- CreateIndex
CREATE UNIQUE INDEX "buyer_chat_sessions_session_token_key" ON "buyer_chat_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_chat_sessions_buyer_lead_id_key" ON "buyer_chat_sessions"("buyer_lead_id");

-- CreateIndex
CREATE INDEX "buyer_chat_sessions_status_idx" ON "buyer_chat_sessions"("status");

-- CreateIndex
CREATE INDEX "buyer_chat_sessions_started_at_idx" ON "buyer_chat_sessions"("started_at");

-- AddForeignKey
ALTER TABLE "buyer_chat_sessions" ADD CONSTRAINT "buyer_chat_sessions_buyer_lead_id_fkey" FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
