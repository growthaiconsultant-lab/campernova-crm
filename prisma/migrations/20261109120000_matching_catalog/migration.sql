ALTER TABLE "vehicles" ADD COLUMN "match_catalog" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "buyer_leads" ADD COLUMN "match_catalog" JSONB NOT NULL DEFAULT '{}';
