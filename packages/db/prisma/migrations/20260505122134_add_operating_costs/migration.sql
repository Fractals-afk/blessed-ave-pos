-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('RENT', 'UTILITIES', 'WAGES', 'PACKAGING', 'MARKETING', 'EQUIPMENT', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "CostFrequency" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "operating_costs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "frequency" "CostFrequency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operating_costs_pkey" PRIMARY KEY ("id")
);
