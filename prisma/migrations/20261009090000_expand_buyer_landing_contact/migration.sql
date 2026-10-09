-- LANDING-2: preserve missing buyer email as NULL; existing values remain untouched.
ALTER TABLE "buyer_leads" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "buyer_leads"
  ADD COLUMN "gdpr_consent_at" TIMESTAMP(3),
  ADD COLUMN "gdpr_consent_ip" TEXT;
