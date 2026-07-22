"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, resolveApiBase } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { useRequireRole } from "@/lib/useRequireRole";
import type { CafeTable, DiscountType, MenuCategory, MenuItem, ModifierOption, Order } from "@blessed-ave/types";
import toast from "react-hot-toast";
import { QrPlaceholder } from "@/components/QrPlaceholder";
import { enqueueOrder, loadMenuCache, newOfflineId, pendingCount, saveMenuCache } from "@/lib/offline";
import { syncOfflineQueue } from "@/lib/sync";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

const MENU_GROUPS: Record<string, string[]> = {
  Drink: ["Beer", "Frappes", "Hot Coffee", "Iced Coffee", "Refreshers & Slushy", "Specialty Lattes"],
  Food: ["Burgers", "Desserts", "Poppers & Fries", "Rice Meals & Mains", "Wings"],
  "Add-ons": ["Add-Ons"],
};
function groupForCategory(name: string): string {
  for (const [group, names] of Object.entries(MENU_GROUPS)) if (names.includes(name)) return group;
  return "Food";
}

function tableBadge(status?: string) {
  if (status === "PENDING") return { label: "Pending Payment", cls: "border-amber-200 bg-amber-50 text-amber-700" };
  if (status === "READY")   return { label: "Ready",           cls: "border-green-200 bg-green-50 text-green-700" };
  if (status === "CONFIRMED" || status === "PREPARING")
    return { label: "Preparing", cls: "border-violet-200 bg-violet-50 text-violet-700" };
  return { label: "Free", cls: "border-slate-200 bg-white text-slate-400" };
}

// Client-side preview only — server recomputes authoritatively from the
// order's own subtotal once the discount is applied. When VAT is off
// (non-VAT registered business) there's no VAT to strip, so senior/PWD is a
// straight 20% off and no VAT portion is shown.
function previewDiscount(subtotal: number, type: DiscountType, customAmount: string, vatEnabled: boolean) {
  if (type === "SENIOR_PWD") {
    const base = vatEnabled ? Math.round(subtotal / 1.12) : subtotal;
    const discount = Math.round(base * 0.2);
    return { total: base - discount, discount, vat: 0 };
  }
  if (type === "CUSTOM") {
    const cents = Math.round(parseFloat(customAmount || "0") * 100) || 0;
    const total = Math.max(0, subtotal - cents);
    return { total, discount: cents, vat: vatEnabled ? Math.round(total - total / 1.12) : 0 };
  }
  return { total: subtotal, discount: 0, vat: vatEnabled ? Math.round(subtotal - subtotal / 1.12) : 0 };
}

function tableSort(a: CafeTable, b: CafeTable) {
  const na = parseInt(a.name.replace(/\D/g, ""), 10);
  const nb = parseInt(b.name.replace(/\D/g, ""), 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return a.name.localeCompare(b.name);
}

interface POSItem {
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: ModifierOption[];
  unitPrice: number;
}

export default function POSPage() {
  const authorized = useRequireRole(["OWNER", "MANAGER", "STAFF"], "/pos/login");
  const { user } = useAuth();
  const isManager = user?.role === "OWNER" || user?.role === "MANAGER";
  const [categories,     setCategories]     = useState<MenuCategory[]>([]);
  const [activeGroup,    setActiveGroup]    = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart,           setCart]           = useState<POSItem[]>([]);
  const [selectedItem,   setSelectedItem]   = useState<MenuItem | null>(null);
  const [itemOptions,    setItemOptions]    = useState<Record<string, ModifierOption[]>>({});
  const [payMethod,      setPayMethod]      = useState<"GCASH" | "MAYA" | "CASH">("CASH");
  const [placing,        setPlacing]        = useState(false);
  const [notes,          setNotes]          = useState("");

  // Discount — applied to a new order before it's placed
  const [discountType,   setDiscountType]   = useState<DiscountType>("NONE");
  const [discountId,     setDiscountId]     = useState("");
  const [customDiscount, setCustomDiscount] = useState("");

  // Business-level VAT toggle (server-side setting; manager/owner only)
  const [vatEnabled,  setVatEnabled]  = useState(true);
  const [togglingVat, setTogglingVat] = useState(false);

  // Discount applied to an existing table order (dine-in, pending payment)
  const [tableDiscountType, setTableDiscountType] = useState<DiscountType>("NONE");
  const [tableDiscountId,   setTableDiscountId]   = useState("");
  const [tableCustomDiscount, setTableCustomDiscount] = useState("");
  const [applyingDiscount,  setApplyingDiscount]  = useState(false);

  // Tables with an active order or a check awaiting payment
  const [tables,       setTables]       = useState<CafeTable[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  // QR confirmation modal
  const [qrOrderId,  setQrOrderId]  = useState<string | null>(null);
  const [qrMethod,   setQrMethod]   = useState<"GCASH" | "MAYA">("GCASH");
  const [qrAmount,   setQrAmount]   = useState(0);
  const [confirming, setConfirming] = useState(false);

  // Cash payment modal — cashier enters amount tendered, change is computed
  const [cashOrderId,   setCashOrderId]   = useState<string | null>(null);
  const [cashDue,       setCashDue]       = useState(0);
  const [cashTendered,  setCashTendered]  = useState("");
  const [cashConfirming, setCashConfirming] = useState(false);
  const [cashOnPaid,    setCashOnPaid]    = useState<(() => void) | null>(null);

  // Table detail modal (request payment / refund / special instructions)
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(null);
  const [notesDraft,    setNotesDraft]    = useState("");
  const [savingNotes,   setSavingNotes]   = useState(false);
  const [refunding,     setRefunding]     = useState(false);

  // Offline cart support — connectivity state, queued-sale count, and the
  // not-yet-created order waiting on the cash/QR modal to pick a payment
  // method before it's written to the local queue.
  const [online,       setOnline]       = useState(true);
  const [queuedCount,  setQueuedCount]  = useState(0);
  const [offlinePending, setOfflinePending] = useState<{
    offlineId: string;
    orderBody: Record<string, unknown>;
    discount?: { discountType: string; discountIdNumber?: string; amount?: number };
  } | null>(null);

  // Restore an in-progress order after a refresh — cart is otherwise pure
  // React state and would be wiped on reload mid-sale.
  useEffect(() => {
    const raw = localStorage.getItem("pos_cart_draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (Array.isArray(draft.cart) && draft.cart.length > 0) setCart(draft.cart);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (draft.payMethod) setPayMethod(draft.payMethod);
      if (draft.discountType) setDiscountType(draft.discountType);
      if (typeof draft.discountId === "string") setDiscountId(draft.discountId);
      if (typeof draft.customDiscount === "string") setCustomDiscount(draft.customDiscount);
    } catch {
      // Corrupt draft — ignore and start fresh.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pos_cart_draft", JSON.stringify({
      cart, notes, payMethod, discountType, discountId, customDiscount,
    }));
  }, [cart, notes, payMethod, discountType, discountId, customDiscount]);

  useEffect(() => {
    adminApi.settings.getVat().then((r) => setVatEnabled(r.data.vatEnabled)).catch(() => {});
    adminApi.menu.getAll().then((r) => {
      setCategories(r.data);
      saveMenuCache(r.data);
      const firstVisible = r.data.find((c) => c.items.some((i) => i.available));
      if (firstVisible) {
        setActiveGroup(groupForCategory(firstVisible.name));
        setActiveCategory(firstVisible.id);
      }
    }).catch(() => {
      // No connection on load — fall back to whatever menu was last cached
      // so the cart can still take orders.
      const cached = loadMenuCache();
      if (!cached) return;
      setCategories(cached);
      const firstVisible = cached.find((c) => c.items.some((i) => i.available));
      if (firstVisible) {
        setActiveGroup(groupForCategory(firstVisible.name));
        setActiveCategory(firstVisible.id);
      }
    });
  }, []);

  // Connectivity tracking + offline queue sync. `navigator.onLine` only
  // reflects the network interface, not real reachability, so a successful
  // sync pass is what actually clears the "offline" banner.
  useEffect(() => {
    setOnline(navigator.onLine);
    setQueuedCount(pendingCount());

    async function attemptSync() {
      if (!navigator.onLine) return;
      const result = await syncOfflineQueue();
      setQueuedCount(pendingCount());
      if (result.synced > 0) toast.success(`Synced ${result.synced} offline sale${result.synced === 1 ? "" : "s"}`);
    }

    function goOnline() { setOnline(true); attemptSync(); }
    function goOffline() { setOnline(false); }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    attemptSync();
    const syncPoll = setInterval(attemptSync, 30000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(syncPoll);
    };
  }, []);

  useEffect(() => {
    adminApi.tables.list().then((r) => setTables(r.data));

    function loadPending() {
      // Orders awaiting payment aren't pushed over the socket (kitchen only
      // learns of an order once it's paid), so poll for new pending checks.
      adminApi.orders.list({ status: "PENDING" }).then((r) =>
        setActiveOrders((prev) => [
          ...r.data,
          ...prev.filter((o) => o.status !== "PENDING"),
        ])
      );
    }
    loadPending();
    adminApi.orders.kitchen().then((r) => setActiveOrders((prev) => [...prev, ...r.data]));
    const pendingPoll = setInterval(loadPending, 10000);

    let socket: ReturnType<typeof io> | undefined;
    resolveApiBase().then((base) => {
      socket = io(base);
      socket.emit("join:kitchen");
      socket.on("order:new", (order: Order) => {
        if (ACTIVE_STATUSES.includes(order.status)) setActiveOrders((prev) => [order, ...prev]);
      });
      socket.on("order:updated", ({ order }: { order: Order }) => {
        setActiveOrders((prev) =>
          ACTIVE_STATUSES.includes(order.status)
            ? prev.map((o) => (o.id === order.id ? order : o))
            : prev.filter((o) => o.id !== order.id)
        );
      });
    });
    return () => { clearInterval(pendingPoll); socket?.disconnect(); };
  }, []);

  const visibleCategories = categories.filter((c) => c.items.some((i) => i.available));
  const visibleGroups = Object.keys(MENU_GROUPS).filter((g) => visibleCategories.some((c) => groupForCategory(c.name) === g));
  const groupCategories = visibleCategories.filter((c) => groupForCategory(c.name) === activeGroup);
  const activeItems = (categories.find((c) => c.id === activeCategory)?.items ?? []).filter((i) => i.available);

  function selectGroup(group: string) {
    setActiveGroup(group);
    const first = visibleCategories.find((c) => groupForCategory(c.name) === group);
    if (first) setActiveCategory(first.id);
  }
  const total       = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemCount   = cart.reduce((s, i) => s + i.quantity, 0);

  const ordersByTable = new Map<string, Order[]>();
  for (const order of activeOrders) {
    if (!order.tableId) continue;
    const list = ordersByTable.get(order.tableId) ?? [];
    list.push(order);
    ordersByTable.set(order.tableId, list);
  }
  for (const list of ordersByTable.values()) {
    list.sort((a, b) => (a.status === "PENDING" ? -1 : b.status === "PENDING" ? 1 : 0));
  }

  const sortedTables = [...tables].sort(tableSort);
  const selectedOrder = selectedTable ? ordersByTable.get(selectedTable.id)?.[0] : undefined;

  function auth() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken")}` };
  }

  async function toggleVat() {
    setTogglingVat(true);
    try {
      const r = await adminApi.settings.setVat(!vatEnabled);
      setVatEnabled(r.data.vatEnabled);
      toast.success(r.data.vatEnabled ? "VAT on — totals include 12% VAT" : "VAT off — no VAT on new orders");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update VAT setting");
    } finally {
      setTogglingVat(false);
    }
  }

  function addToCart(item: MenuItem) {
    if ((item.modifierGroups ?? []).length > 0) { setSelectedItem(item); setItemOptions({}); return; }
    pushItem(item, [], item.price);
  }

  function pushItem(item: MenuItem, options: ModifierOption[], unitPrice: number) {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.menuItem.id === item.id &&
          JSON.stringify(i.selectedOptions.map((o) => o.id).sort()) ===
          JSON.stringify(options.map((o) => o.id).sort())
      );
      if (existing) return prev.map((i) => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItem: item, quantity: 1, selectedOptions: options, unitPrice }];
    });
    setSelectedItem(null);
  }

  function confirmModifiers() {
    if (!selectedItem) return;
    for (const group of selectedItem.modifierGroups ?? []) {
      if (group.required && !(itemOptions[group.id]?.length)) {
        toast.error(`Please choose a ${group.name}`);
        return;
      }
    }
    const allOptions = Object.values(itemOptions).flat();
    const unitPrice  = selectedItem.price + allOptions.reduce((s, o) => s + o.priceAdjustment, 0);
    pushItem(selectedItem, allOptions, unitPrice);
  }

  // Applies the currently-selected discount to a PENDING order; returns the
  // updated order (with recomputed total) or throws.
  async function applyDiscount(orderId: string, type: DiscountType, idNumber: string, customAmount: string): Promise<Order> {
    let body: unknown;
    if (type === "SENIOR_PWD") {
      if (!idNumber.trim()) throw new Error("Senior/PWD ID number is required");
      body = { discountType: "SENIOR_PWD", discountIdNumber: idNumber.trim() };
    } else if (type === "CUSTOM") {
      const cents = Math.round(parseFloat(customAmount || "0") * 100);
      if (isNaN(cents) || cents <= 0) throw new Error("Enter a valid discount amount");
      body = { discountType: "CUSTOM", amount: cents };
    } else {
      return (await adminApi.orders.setDiscount(orderId, { discountType: "NONE" })).data;
    }
    return (await adminApi.orders.setDiscount(orderId, body)).data;
  }

  function discountForSync(): { discountType: string; discountIdNumber?: string; amount?: number } | undefined {
    if (discountType === "NONE") return undefined;
    if (discountType === "SENIOR_PWD") return { discountType, discountIdNumber: discountId.trim() };
    return { discountType, amount: Math.round(parseFloat(customDiscount || "0") * 100) };
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const orderBody = {
        source: "POS", notes,
        items: cart.map((i) => ({
          menuItemId: i.menuItem.id, quantity: i.quantity,
          selectedOptions: i.selectedOptions.map((o) => ({ modifierOptionId: o.id })),
        })),
      };

      if (!online) {
        // No connection — stash the order locally and let the cashier still
        // pick cash/QR and enter the tendered amount; nothing hits the
        // network until confirmCashPayment/confirmQrPayment enqueue it.
        const preview = previewDiscount(total, discountType, customDiscount, vatEnabled);
        const offlineId = newOfflineId();
        setOfflinePending({ offlineId, orderBody, discount: discountForSync() });
        if (payMethod === "CASH") {
          setCashOrderId(offlineId);
          setCashDue(preview.total);
          setCashTendered("");
          setCashOnPaid(() => () => {
            setCart([]); setNotes(""); setDiscountType("NONE"); setDiscountId(""); setCustomDiscount("");
          });
        } else {
          setQrMethod(payMethod);
          setQrAmount(preview.total);
          setQrOrderId(offlineId);
        }
        return;
      }

      const API = await resolveApiBase();
      const res = await fetch(`${API}/api/orders`, { method: "POST", headers: auth(), body: JSON.stringify(orderBody) });
      const resBody = await res.json();
      if (!res.ok) throw new Error(resBody.error ?? "Failed to place order");
      let order = resBody.data;

      if (discountType !== "NONE") {
        order = await applyDiscount(order.id, discountType, discountId, customDiscount);
      }

      if (payMethod === "CASH") {
        setCashOrderId(order.id);
        setCashDue(order.total);
        setCashTendered("");
        setCashOnPaid(() => () => {
          setCart([]); setNotes(""); setDiscountType("NONE"); setDiscountId(""); setCustomDiscount("");
        });
      } else {
        // Show QR modal for cashier
        setQrMethod(payMethod);
        setQrAmount(order.total);
        setQrOrderId(order.id);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setPlacing(false);
    }
  }

  async function confirmQrPayment() {
    if (!qrOrderId) return;
    setConfirming(true);
    try {
      if (offlinePending && offlinePending.offlineId === qrOrderId) {
        enqueueOrder({
          offlineId: offlinePending.offlineId, createdAt: new Date().toISOString(),
          orderBody: offlinePending.orderBody, discount: offlinePending.discount,
          payment: { method: qrMethod }, synced: false, localPreview: {} as Order,
        });
        setQueuedCount(pendingCount());
        toast.success(`${qrMethod === "GCASH" ? "QR" : "Credit Card"} sale saved offline — will sync when online`);
        setOfflinePending(null);
        setQrOrderId(null);
        setCart([]); setNotes(""); setDiscountType("NONE"); setDiscountId(""); setCustomDiscount("");
        return;
      }
      const API = await resolveApiBase();
      const res = await fetch(`${API}/api/payments/qr-confirm`, {
        method: "POST", headers: auth(),
        body: JSON.stringify({ orderId: qrOrderId, method: qrMethod }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to confirm");
      toast.success(`Order #${qrOrderId.slice(-4).toUpperCase()} — ${qrMethod} paid ✓`);
      setQrOrderId(null);
      setCart([]); setNotes(""); setDiscountType("NONE"); setDiscountId(""); setCustomDiscount("");
      setSelectedTable(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  }

  function openTable(table: CafeTable) {
    setSelectedTable(table);
    const order = ordersByTable.get(table.id)?.[0];
    setNotesDraft(order?.notes ?? "");
    setTableDiscountType(order?.discountType ?? "NONE");
    setTableDiscountId(order?.discountIdNumber ?? "");
    setTableCustomDiscount("");
  }

  async function applyTableDiscount(order: Order) {
    setApplyingDiscount(true);
    try {
      await applyDiscount(order.id, tableDiscountType, tableDiscountId, tableCustomDiscount);
      toast.success(tableDiscountType === "NONE" ? "Discount removed" : "Discount applied");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to apply discount");
    } finally {
      setApplyingDiscount(false);
    }
  }

  function requestPayment(order: Order, method: "GCASH" | "MAYA") {
    setQrMethod(method);
    setQrAmount(order.total);
    setQrOrderId(order.id);
  }

  function requestCashPayment(order: Order) {
    setCashOrderId(order.id);
    setCashDue(order.total);
    setCashTendered("");
    setCashOnPaid(() => () => setSelectedTable(null));
  }

  async function confirmCashPayment() {
    if (!cashOrderId) return;
    setCashConfirming(true);
    try {
      if (offlinePending && offlinePending.offlineId === cashOrderId) {
        enqueueOrder({
          offlineId: offlinePending.offlineId, createdAt: new Date().toISOString(),
          orderBody: offlinePending.orderBody, discount: offlinePending.discount,
          payment: { method: "CASH" }, synced: false, localPreview: {} as Order,
        });
        setQueuedCount(pendingCount());
        toast.success("Cash sale saved offline — will sync when online");
        setOfflinePending(null);
        cashOnPaid?.();
        setCashOrderId(null);
        return;
      }
      const API = await resolveApiBase();
      const res = await fetch(`${API}/api/payments/cash`, {
        method: "POST", headers: auth(),
        body: JSON.stringify({ orderId: cashOrderId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Cash payment failed");
      toast.success(`Order #${cashOrderId.slice(-4).toUpperCase()} — Cash paid ✓`);
      cashOnPaid?.();
      setCashOrderId(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setCashConfirming(false);
    }
  }

  async function refundOrder(order: Order) {
    if (!confirm(`Refund ₱${(order.total / 100).toFixed(2)} for this order? This will cancel it.`)) return;
    setRefunding(true);
    try {
      const API = await resolveApiBase();
      const res = await fetch(`${API}/api/payments/refund`, {
        method: "POST", headers: auth(),
        body: JSON.stringify({ orderId: order.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Refund failed");
      toast.success(`Order #${order.id.slice(-4).toUpperCase()} — Refunded`);
      setSelectedTable(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to refund");
    } finally {
      setRefunding(false);
    }
  }

  async function saveNotes(order: Order) {
    setSavingNotes(true);
    try {
      await adminApi.orders.updateNotes(order.id, notesDraft);
      toast.success("Instructions saved");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSavingNotes(false);
    }
  }

  const GCASH_QR = process.env.NEXT_PUBLIC_GCASH_QR_URL;
  const MAYA_QR  = process.env.NEXT_PUBLIC_MAYA_QR_URL;
  const qrUrl    = qrMethod === "GCASH" ? GCASH_QR : MAYA_QR;

  if (!authorized) return null;

  return (
    <AdminLayout>
      <div className="flex h-screen flex-col overflow-hidden">
      {(!online || queuedCount > 0) && (
        <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold ${online ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-amber-500" : "bg-red-500 animate-pulse"}`} />
          {online ? `Syncing — ${queuedCount} offline sale${queuedCount === 1 ? "" : "s"} pending` : `Offline — ${queuedCount} sale${queuedCount === 1 ? "" : "s"} queued, will sync automatically`}
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-[68%] overflow-hidden">

        {/* ── Menu panel ───────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 pt-3 scrollbar-hide">
            {visibleGroups.map((group) => (
              <button key={group} onClick={() => selectGroup(group)}
                className={`flex-shrink-0 rounded-t-xl px-5 py-2.5 text-base font-bold transition active:scale-[0.97] ${
                  activeGroup === group ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}>
                {group}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 scrollbar-hide">
            {groupCategories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 rounded-xl px-5 py-3 text-base font-semibold transition active:scale-[0.97] ${
                  activeCategory === cat.id ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
              {activeItems.map((item) => (
                <button key={item.id} onClick={() => addToCart(item)}
                  className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-slate-300 hover:shadow-md transition active:scale-[0.97] min-h-[104px]">
                  <p className="font-semibold text-slate-800 text-base leading-tight">{item.name}</p>
                  {item.description && <p className="text-sm text-slate-400 mt-1 line-clamp-1">{item.description}</p>}
                  <p className="mt-2 text-base font-bold text-green-600">₱{(item.price / 100).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Cart panel ───────────────────────────────────────── */}
        <div className="flex w-80 flex-col border-l border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">Current Order</h2>
            {itemCount > 0 && <span className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-slate-400 text-sm">Cart is empty</p>
                <p className="text-xs text-slate-300 mt-1">Tap an item to add</p>
              </div>
            )}
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between py-2 border-b border-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-tight">{item.menuItem.name}</p>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-xs text-slate-400 truncate">{item.selectedOptions.map((o) => o.name).join(", ")}</p>
                  )}
                  <p className="text-xs font-semibold text-green-600 mt-0.5">₱{((item.unitPrice * item.quantity) / 100).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => setCart((prev) => item.quantity <= 1 ? prev.filter((_, i) => i !== idx) : prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity - 1 } : it))}
                    className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition text-base flex items-center justify-center active:scale-[0.95]">
                    −
                  </button>
                  <span className="text-sm font-bold text-slate-800 w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => setCart((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                    className="h-9 w-9 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition text-base flex items-center justify-center active:scale-[0.95]">
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-4 space-y-3">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Order notes…" rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />

            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "GCASH", "MAYA"] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className={`rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.97] ${
                    payMethod === m ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {m === "GCASH" ? "QR" : m === "MAYA" ? "Credit Card" : "Cash"}
                </button>
              ))}
            </div>

            {isManager && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">VAT (12% incl.)</p>
                <button onClick={toggleVat} disabled={togglingVat}
                  className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${vatEnabled ? "bg-green-500" : "bg-slate-300"}`}
                  aria-label={vatEnabled ? "Turn VAT off" : "Turn VAT on"}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${vatEnabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Discount</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(["NONE", "SENIOR_PWD", "CUSTOM"] as const).map((t) => (
                  <button key={t} disabled={t === "CUSTOM" && !isManager}
                    onClick={() => setDiscountType(t)}
                    className={`rounded-lg border py-2 text-xs font-semibold transition disabled:opacity-30 ${
                      discountType === t ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}>
                    {t === "NONE" ? "None" : t === "SENIOR_PWD" ? "Senior/PWD" : "Custom"}
                  </button>
                ))}
              </div>
              {discountType === "SENIOR_PWD" && (
                <input value={discountId} onChange={(e) => setDiscountId(e.target.value)}
                  placeholder="OSCA / PWD ID number" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
              )}
              {discountType === "CUSTOM" && (
                <input type="number" min="0" step="0.01" value={customDiscount} onChange={(e) => setCustomDiscount(e.target.value)}
                  placeholder="Discount amount (₱)" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
              )}
            </div>

            {(() => {
              const preview = previewDiscount(total, discountType, customDiscount, vatEnabled);
              return (
                <div className="space-y-1 text-sm">
                  {discountType !== "NONE" && (
                    <>
                      <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₱{(total / 100).toFixed(2)}</span></div>
                      <div className="flex justify-between text-red-500"><span>Discount</span><span>−₱{(preview.discount / 100).toFixed(2)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total {preview.vat > 0 && <span className="text-xs text-slate-300">(incl. ₱{(preview.vat / 100).toFixed(2)} VAT)</span>}</span>
                    <span className="text-2xl font-bold text-slate-900">₱{(preview.total / 100).toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            <button onClick={placeOrder} disabled={cart.length === 0 || placing}
              className="w-full rounded-xl bg-[#0f172a] py-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition active:scale-[0.98]">
              {placing ? "Placing…" : payMethod === "CASH" ? "Place Order (Cash)" : `Place Order → Show QR`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tables bar ───────────────────────────────────────── */}
      <div className="flex h-[32%] flex-col border-t border-slate-200 bg-white overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid h-full grid-cols-5 grid-rows-3 gap-2">
            {sortedTables.map((table) => {
              const order = ordersByTable.get(table.id)?.[0];
              const count = ordersByTable.get(table.id)?.length ?? 0;
              const badge = tableBadge(order?.status);
              return (
                <button key={table.id} onClick={() => openTable(table)}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 text-center transition hover:shadow-md active:scale-[0.98] ${badge.cls}`}>
                  <span className="text-base font-bold">{table.name}</span>
                  <span className="text-xs opacity-70">{badge.label}</span>
                  {count > 1 && <span className="text-[10px] opacity-70">({count} orders)</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* ── Table detail modal ──────────────────────────────────── */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTable(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900">{selectedTable.name}</h3>
                {selectedOrder && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order #{selectedOrder.id.slice(-4).toUpperCase()} · {tableBadge(selectedOrder.status).label}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedTable(null)}
                className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-lg leading-none">
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {!selectedOrder && (
                <p className="text-sm text-slate-400 text-center py-6">No active order for this table.</p>
              )}

              {selectedOrder && (
                <>
                  <ul className="space-y-1">
                    {selectedOrder.items.map((item) => (
                      <li key={item.id} className="text-sm flex justify-between">
                        <span className="text-slate-700">{item.quantity}× {item.menuItemName}</span>
                        <span className="text-slate-500">₱{(item.subtotal / 100).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-red-500 pt-2">
                      <span>Discount ({selectedOrder.discountType === "SENIOR_PWD" ? "Senior/PWD" : "Custom"})</span>
                      <span>−₱{(selectedOrder.discountAmount / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-sm text-slate-500">Total {selectedOrder.vatAmount > 0 && <span className="text-xs text-slate-300">(incl. ₱{(selectedOrder.vatAmount / 100).toFixed(2)} VAT)</span>}</span>
                    <span className="text-lg font-bold text-slate-900">₱{(selectedOrder.total / 100).toFixed(2)}</span>
                  </div>

                  {selectedOrder.status === "PENDING" && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Discount</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["NONE", "SENIOR_PWD", "CUSTOM"] as const).map((t) => (
                          <button key={t} disabled={t === "CUSTOM" && !isManager}
                            onClick={() => setTableDiscountType(t)}
                            className={`rounded-lg border py-1.5 text-xs font-semibold transition disabled:opacity-30 ${
                              tableDiscountType === t ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}>
                            {t === "NONE" ? "None" : t === "SENIOR_PWD" ? "Senior/PWD" : "Custom"}
                          </button>
                        ))}
                      </div>
                      {tableDiscountType === "SENIOR_PWD" && (
                        <input value={tableDiscountId} onChange={(e) => setTableDiscountId(e.target.value)}
                          placeholder="OSCA / PWD ID number" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
                      )}
                      {tableDiscountType === "CUSTOM" && (
                        <input type="number" min="0" step="0.01" value={tableCustomDiscount} onChange={(e) => setTableCustomDiscount(e.target.value)}
                          placeholder="Discount amount (₱)" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
                      )}
                      <button onClick={() => applyTableDiscount(selectedOrder)} disabled={applyingDiscount}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                        {applyingDiscount ? "Applying…" : "Apply Discount"}
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Special Instructions</p>
                    <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="e.g. no sugar, allergy…" rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                    <button onClick={() => saveNotes(selectedOrder)} disabled={savingNotes}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                      {savingNotes ? "Saving…" : "Save Instructions"}
                    </button>
                  </div>

                  {selectedOrder.status === "PENDING" && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Request Payment</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => requestCashPayment(selectedOrder)}
                          className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 transition">
                          Cash
                        </button>
                        <button onClick={() => requestPayment(selectedOrder, "GCASH")}
                          className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 transition">
                          QR
                        </button>
                        <button onClick={() => requestPayment(selectedOrder, "MAYA")}
                          className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 transition">
                          Credit Card
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedOrder.payment?.status === "PAID" && (
                    <button onClick={() => refundOrder(selectedOrder)} disabled={refunding}
                      className="w-full rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50">
                      {refunding ? "Refunding…" : "Refund & Cancel Order"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modifier modal ───────────────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 mx-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-900">{selectedItem.name}</h3>
                <p className="text-sm text-slate-400">₱{(selectedItem.price / 100).toFixed(2)} base</p>
              </div>
              <button onClick={() => setSelectedItem(null)}
                className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-lg leading-none">
                ×
              </button>
            </div>

            {(selectedItem.modifierGroups ?? []).map((group) => (
              <div key={group.id} className="mb-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  {group.name} {group.required && <span className="text-red-400 normal-case">• required</span>}
                </p>
                <div className="space-y-1.5">
                  {group.options.map((opt) => {
                    const sel = (itemOptions[group.id] ?? []).some((o) => o.id === opt.id);
                    return (
                      <button key={opt.id}
                        onClick={() => setItemOptions((prev) => {
                          const cur = prev[group.id] ?? [];
                          if (group.multiSelect) return { ...prev, [group.id]: sel ? cur.filter((o) => o.id !== opt.id) : [...cur, opt] };
                          return { ...prev, [group.id]: [opt] };
                        })}
                        className={`flex w-full justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
                          sel ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}>
                        <span>{opt.name}</span>
                        {opt.priceAdjustment !== 0 && (
                          <span className={sel ? "text-slate-300" : "text-slate-400"}>
                            {opt.priceAdjustment > 0 ? "+" : "−"}₱{(Math.abs(opt.priceAdjustment) / 100).toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelectedItem(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={confirmModifiers}
                className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Payment modal ─────────────────────────────────────── */}
      {qrOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 mx-4 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 text-white ${qrMethod === "GCASH" ? "bg-blue-600" : "bg-green-600"}`}>
              <p className="font-bold text-lg">{qrMethod === "GCASH" ? "QR" : "Credit Card"} Payment</p>
              <p className="text-sm opacity-80 mt-0.5">
                Order #{qrOrderId.slice(-6).toUpperCase()} · ₱{(qrAmount / 100).toFixed(2)}
              </p>
            </div>

            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 mb-4">
                Ask customer to scan to pay via {qrMethod === "GCASH" ? "QR" : "Credit Card"}
              </p>
              <div className="inline-block rounded-2xl border-4 border-slate-100 overflow-hidden shadow-sm">
                {qrUrl
                  ? <img src={qrUrl} alt={`${qrMethod} QR`} className="w-56 h-56 object-contain" />
                  : <QrPlaceholder method={qrMethod} size={224} />
                }
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Amount: <strong className="text-slate-700">₱{(qrAmount / 100).toFixed(2)}</strong>
              </p>

              <div className="mt-6 space-y-2">
                <button onClick={confirmQrPayment} disabled={confirming}
                  className={`w-full rounded-xl py-3.5 font-bold text-white transition active:scale-[0.98] disabled:opacity-60 ${
                    qrMethod === "GCASH" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                  }`}>
                  {confirming ? "Confirming…" : "✓ Payment Received — Confirm"}
                </button>
                <button onClick={() => setQrOrderId(null)}
                  className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash Payment modal ───────────────────────────────────── */}
      {cashOrderId && (() => {
        const tenderedCents = Math.round(parseFloat(cashTendered || "0") * 100) || 0;
        const change = tenderedCents - cashDue;
        const insufficient = tenderedCents <= 0 || change < 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 mx-4 overflow-hidden">
              <div className="px-6 py-4 bg-slate-800 text-white">
                <p className="font-bold text-lg">Cash Payment</p>
                <p className="text-sm opacity-80 mt-0.5">
                  Order #{cashOrderId.slice(-6).toUpperCase()} · ₱{(cashDue / 100).toFixed(2)} due
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Cash received
                  </label>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal" autoFocus
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={`₱${(cashDue / 100).toFixed(2)}`}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-2xl font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[100, 200, 500, 1000].map((bill) => (
                    <button key={bill} onClick={() => setCashTendered(bill.toFixed(2))}
                      className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 transition active:scale-[0.95]">
                      ₱{bill}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-500">Change</span>
                  <span className={`text-2xl font-bold ${insufficient ? "text-slate-300" : "text-green-600"}`}>
                    ₱{(Math.max(change, 0) / 100).toFixed(2)}
                  </span>
                </div>
                {tenderedCents > 0 && change < 0 && (
                  <p className="text-xs text-red-500 -mt-2">Short by ₱{(Math.abs(change) / 100).toFixed(2)}</p>
                )}

                <div className="space-y-2 pt-1">
                  <button onClick={confirmCashPayment} disabled={cashConfirming || insufficient}
                    className="w-full rounded-xl bg-slate-800 py-3.5 font-bold text-white transition active:scale-[0.98] disabled:opacity-40 hover:bg-slate-700">
                    {cashConfirming ? "Confirming…" : "✓ Confirm Cash Payment"}
                  </button>
                  <button onClick={() => setCashOrderId(null)} disabled={cashConfirming}
                    className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 transition disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </AdminLayout>
  );
}
