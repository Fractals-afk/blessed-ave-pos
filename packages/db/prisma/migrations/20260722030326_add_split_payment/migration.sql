-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'SPLIT';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "splitDetails" JSONB;
