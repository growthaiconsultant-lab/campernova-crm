-- CAM-62: temperatura comercial del lead comprador (aditivo, sin destructivos)

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('HOT', 'WARM', 'COLD');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'TEMPERATURA_ACTUALIZADA';

-- AlterTable
ALTER TABLE "buyer_leads" ADD COLUMN     "temperature" "LeadTemperature";
