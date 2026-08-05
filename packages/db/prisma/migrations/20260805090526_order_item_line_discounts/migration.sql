-- AlterTable: move discount type/amount onto each order line so different
-- lines can carry different discounts (was: a single boolean marking a line
-- as qualifying for the order's one shared discount type).
ALTER TABLE "order_items" ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "order_items" ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: prior seniorDiscount=true lines become discountType=SENIOR_PWD
-- (amount left at 0 — it was never stored per-line, only at the order level).
UPDATE "order_items" SET "discountType" = 'SENIOR_PWD' WHERE "seniorDiscount" = true;

ALTER TABLE "order_items" DROP COLUMN "seniorDiscount";
