// Offline cart support for POS: caches the menu locally so it still loads
// with no connection, and queues orders/payments taken while offline so
// they can be pushed to the server once the cart reconnects.
import type { MenuCategory, Order } from "@blessed-ave/types";

const MENU_CACHE_KEY = "pos_menu_cache_v1";
const QUEUE_KEY = "pos_offline_queue_v1";

export function saveMenuCache(categories: MenuCategory[]) {
  try {
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(categories));
  } catch {
    // storage full/unavailable — cart just won't have an offline menu fallback
  }
}

export function loadMenuCache(): MenuCategory[] | null {
  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// A queued sale: the order-creation payload plus how it was paid, keyed by
// a client-generated offlineId so a repeated sync attempt never double-books
// the same sale on the server.
export interface QueuedOrder {
  offlineId: string;
  createdAt: string;
  orderBody: Record<string, unknown>;
  payment: { method: "CASH" | "GCASH" | "MAYA" };
  discount?: { discountType: string; discountIdNumber?: string; amount?: number };
  synced: boolean;
  // Populated once the order half of the sync succeeds, so a retry of the
  // payment step doesn't need to re-create the order.
  serverOrderId?: string;
  localPreview: Order;
}

function readQueue(): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOrder[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort — if storage is full there's nothing more we can do here
  }
}

export function getQueue(): QueuedOrder[] {
  return readQueue();
}

export function pendingCount(): number {
  return readQueue().filter((q) => !q.synced).length;
}

export function enqueueOrder(entry: QueuedOrder) {
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
}

export function updateQueuedOrder(offlineId: string, patch: Partial<QueuedOrder>) {
  const queue = readQueue();
  const idx = queue.findIndex((q) => q.offlineId === offlineId);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], ...patch };
  writeQueue(queue);
}

// Drops fully-synced entries once they're no longer needed for UI display.
export function clearSynced() {
  writeQueue(readQueue().filter((q) => !q.synced));
}

export function newOfflineId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `off_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
