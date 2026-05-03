-- AlterTable
ALTER TABLE "seller_leads" ADD COLUMN     "gdpr_consent_at" TIMESTAMP(3),
ADD COLUMN     "gdpr_consent_ip" TEXT;
