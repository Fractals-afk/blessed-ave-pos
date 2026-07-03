import cron from "node-cron";
import { prisma } from "@blessed-ave/db";
import { sendLowStockAlert } from "../mailer";

/**
 * Finds every inventory item currently at or below its restock minimum
 * (lowStockThreshold) and emails the owner/admin a summary.
 *
 * Exported standalone so it can be unit-tested / triggered manually
 * (e.g. `ts-node -e "require('./src/jobs/lowStockAlert').runLowStockAlertJob()"`)
 * without waiting for the cron schedule.
 */
export async function runLowStockAlertJob() {
  const items = await prisma.inventoryItem.findMany({
    orderBy: { name: "asc" },
  });

  const lowItems = items.filter((i) => i.currentStock <= i.lowStockThreshold);

  if (lowItems.length === 0) {
    console.log("[low-stock-alert] No items below restock minimum — skipping email.");
    return lowItems;
  }

  await sendLowStockAlert(
    lowItems.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      currentStock: i.currentStock,
      lowStockThreshold: i.lowStockThreshold,
    }))
  );

  return lowItems;
}

/**
 * Registers the daily 4am low-stock alert cron job.
 * Uses the server's local timezone unless CRON_TIMEZONE is set.
 */
export function scheduleLowStockAlertJob() {
  const schedule = process.env.LOW_STOCK_ALERT_CRON ?? "0 4 * * *"; // every day at 4:00 AM
  const timezone = process.env.CRON_TIMEZONE;

  cron.schedule(
    schedule,
    () => {
      runLowStockAlertJob().catch((err) => {
        console.error("[low-stock-alert] Job failed:", err);
      });
    },
    timezone ? { timezone } : undefined
  );

  console.log(
    `[low-stock-alert] Scheduled daily low-stock alert job (cron "${schedule}"${timezone ? `, tz ${timezone}` : ""}).`
  );
}
