-- Kitchen display polls WHERE status IN (...) ORDER BY createdAt with no index
-- backing it (full table scan on the hottest query path in the app). Postgres
-- doesn't auto-index foreign keys either, so tableId/staffId joins scan too.
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

CREATE INDEX "orders_tableId_idx" ON "orders"("tableId");

CREATE INDEX "orders_staffId_idx" ON "orders"("staffId");
