-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'TRUST_SELLO_OTORGADO';
ALTER TYPE "ActivityType" ADD VALUE 'TRUST_SELLO_REVOCADO';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "trust_notes" TEXT,
ADD COLUMN     "trust_verified_at" TIMESTAMP(3),
ADD COLUMN     "trust_verified_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_trust_verified_by_id_fkey" FOREIGN KEY ("trust_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

