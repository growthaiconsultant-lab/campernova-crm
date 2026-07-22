-- I3C1B (contract): cierra el patrón expand–contract haciendo offer_id obligatorio.
-- Seguro solo con cero filas `offer_id IS NULL` (el código I3C1A desplegado siempre persiste offerId).
-- Preflight obligatorio antes de aplicar en cada entorno remoto (ver scripts/check-delivery-offer-nulls).
ALTER TABLE "deliveries" ALTER COLUMN "offer_id" SET NOT NULL;
