// Drains the offline order queue (see offline.ts) once the cart is back
// online: creates each queued order server-side (idempotent via offlineId —
// discounts are embedded per-line in orderBody.items already), then confirms
// the payment the same way the cashier already recorded it locally.
import { resolveApiBase } from "./api";
import { getQueue, updateQueuedOrder, type QueuedOrder } from "./offline";

function auth(): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken")}` };
}

async function syncOne(entry: QueuedOrder, API: string): Promise<void> {
  let orderId = entry.serverOrderId;

  if (!orderId) {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ ...entry.orderBody, offlineId: entry.offlineId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Sync: failed to create order");
    orderId = body.data.id;
    updateQueuedOrder(entry.offlineId, { serverOrderId: orderId });
  }

  const paymentPath = entry.payment.method === "CASH" ? "/api/payments/cash" : "/api/payments/qr-confirm";
  const paymentBody =
    entry.payment.method === "CASH"
      ? { orderId }
      : { orderId, method: entry.payment.method };
  const payRes = await fetch(`${API}${paymentPath}`, {
    method: "POST", headers: auth(), body: JSON.stringify(paymentBody),
  });
  if (!payRes.ok) throw new Error((await payRes.json()).error ?? "Sync: failed to confirm payment");

  updateQueuedOrder(entry.offlineId, { synced: true });
}

let syncing = false;

// Runs sequentially (not in parallel) so order creation retries don't race
// against each other and so a mid-queue failure leaves later entries queued
// for the next attempt instead of half-applied.
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const API = await resolveApiBase();
    const pending = getQueue().filter((q) => !q.synced);
    for (const entry of pending) {
      try {
        await syncOne(entry, API);
        synced++;
      } catch {
        failed++;
        // stop on first failure — likely still offline or a transient error;
        // remaining entries stay queued for the next online/interval trigger
        break;
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed };
}
