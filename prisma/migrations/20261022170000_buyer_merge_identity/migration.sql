-- Additive: retain originals and their conversations; canonical records remain unchanged until merge.
ALTER TABLE "buyer_leads" ADD COLUMN "merged_into_id" TEXT, ADD COLUMN "merged_at" TIMESTAMP(3);
CREATE INDEX "buyer_leads_merged_into_id_idx" ON "buyer_leads"("merged_into_id");
ALTER TABLE "buyer_leads" ADD CONSTRAINT "buyer_leads_merged_into_id_fkey"
FOREIGN KEY ("merged_into_id") REFERENCES "buyer_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "buyer_leads" ADD CONSTRAINT "buyer_leads_merge_pair_check" CHECK (
  ("merged_into_id" IS NULL AND "merged_at" IS NULL)
  OR ("merged_into_id" IS NOT NULL AND "merged_at" IS NOT NULL AND "merged_into_id" <> "id" AND "archived_at" IS NOT NULL)
);
CREATE TABLE "buyer_contacts" (
  "hash" TEXT NOT NULL, "buyer_lead_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "buyer_contacts_pkey" PRIMARY KEY ("hash")
);
CREATE INDEX "buyer_contacts_buyer_lead_id_idx" ON "buyer_contacts"("buyer_lead_id");
ALTER TABLE "buyer_contacts" ADD CONSTRAINT "buyer_contacts_buyer_lead_id_fkey"
FOREIGN KEY ("buyer_lead_id") REFERENCES "buyer_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buyer_contacts" ENABLE ROW LEVEL SECURITY;
-- Multiple original conversations now belong to one canonical buyer, without rewriting messages.
DROP INDEX "buyer_chat_sessions_buyer_lead_id_key";
CREATE INDEX "buyer_chat_sessions_buyer_lead_id_idx" ON "buyer_chat_sessions"("buyer_lead_id");

-- Serialize late activity inserts with merge row locks and route them to the canonical buyer.
-- INVOKER privilege only; no public data-reading function or expanded RLS permission.
CREATE FUNCTION public.canonical_activity_buyer() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE canonical TEXT;
BEGIN
  IF NEW.buyer_lead_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(merged_into_id, id) INTO canonical FROM public.buyer_leads
    WHERE id = NEW.buyer_lead_id FOR KEY SHARE;
  IF canonical IS NOT NULL THEN NEW.buyer_lead_id := canonical; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.canonical_activity_buyer() FROM PUBLIC;
CREATE TRIGGER activity_canonical_buyer BEFORE INSERT OR UPDATE OF buyer_lead_id ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.canonical_activity_buyer();
