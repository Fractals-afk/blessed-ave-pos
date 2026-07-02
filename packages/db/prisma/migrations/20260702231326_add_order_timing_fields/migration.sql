-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "collectedAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);
