CREATE TABLE "buyer_lead_assignment" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "agent_ids" TEXT[] NOT NULL,
  "next_index" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "buyer_lead_assignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "buyer_lead_assignment_singleton" CHECK (id = 1),
  CONSTRAINT "buyer_lead_assignment_cursor" CHECK (next_index >= 0)
);
ALTER TABLE "buyer_lead_assignment" ENABLE ROW LEVEL SECURITY;

-- No SECURITY DEFINER: public/anonymous callers acquire no additional privilege.
-- Row lock serializes rotations; cursor updates roll back with the lead transaction.
CREATE FUNCTION public.assign_new_buyer_lead() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  pool TEXT[];
  cursor_index INTEGER;
  candidate TEXT;
  offset_index INTEGER;
BEGIN
  IF NEW.agent_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT agent_ids, next_index INTO pool, cursor_index
    FROM public.buyer_lead_assignment WHERE id = 1 AND enabled FOR UPDATE;
  IF pool IS NULL OR cardinality(pool) = 0 THEN RETURN NEW; END IF;
  FOR offset_index IN 0..cardinality(pool)-1 LOOP
    candidate := pool[1 + ((cursor_index + offset_index) % cardinality(pool))];
    IF EXISTS (SELECT 1 FROM public.users WHERE id = candidate AND active
               AND role IN ('ADMIN', 'AGENTE')) THEN
      NEW.agent_id := candidate;
      UPDATE public.buyer_lead_assignment
        SET next_index = (cursor_index + offset_index + 1) % cardinality(pool) WHERE id = 1;
      RETURN NEW;
    END IF;
  END LOOP;
  -- Preserve intake availability if all configured users become inactive.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_new_buyer_lead() FROM PUBLIC;
CREATE TRIGGER buyer_lead_auto_assignment
  BEFORE INSERT ON public.buyer_leads
  FOR EACH ROW EXECUTE FUNCTION public.assign_new_buyer_lead();
