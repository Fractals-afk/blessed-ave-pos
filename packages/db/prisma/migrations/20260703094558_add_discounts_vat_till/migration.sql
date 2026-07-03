-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'SENIOR_PWD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TillSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discountIdNumber" TEXT,
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "vatAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "till_sessions" (
    "id" TEXT NOT NULL,
    "status" "TillSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" INTEGER NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "expectedCash" INTEGER,
    "actualCash" INTEGER,
    "variance" INTEGER,
    "notes" TEXT,

    CONSTRAINT "till_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
