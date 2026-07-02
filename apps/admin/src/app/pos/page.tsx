"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi, resolveApiBase } from "@/lib/api";
import type { CafeTable, MenuCategory, MenuItem, ModifierOption, Order } from "@blessed-ave/types";
import toast from "react-hot-toast";
import { QrPlaceholder } from "@/components/QrPlaceholder";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

function tableBadge(status?: string) {
  if (status === "PENDING") return { label: "Pending Payment", cls: "border-amber-200 bg-amber-50 text-amber-700" };
  if (status === "READY")   return { label: "Ready",           cls: "border-green-200 bg-green-50 text-green-700" };
  if (status === "CONFIRMED" || status === "PREPARING")
    return { label: "Preparing", cls: "border-violet-200 bg-violet-50 text-violet-700" };
  return { label: "Free", cls: "border-slate-200 bg-white text-slate-400" };
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
  const [categories,     setCategories]     = useState<MenuCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart,           setCart]           = useState<POSItem[]>([]);
  const [selectedItem,   setSelectedItem]   = useState<MenuItem | null>(null);
  const [itemOptions,    setItemOptions]    = useState<Record<string, ModifierOption[]>>({});
  const [payMethod,      setPayMethod]      = useState<"GCASH" | "MAYA" | "CASH">("CASH");
  const [placing,        setPlacing]        = useState(false);
  const [notes,          setNotes]          = useState("");

  // Tables with an active order or a check awaiting payment
  const [tables,       setTables]       = useState<CafeTable[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  // QR confirmation modal
  const [qrOrderId,  setQrOrderId]  = useState<string | null>(null);
  const [qrMethod,   setQrMethod]   = useState<"GCASH" | "MAYA">("GCASH");
  const [qrAmount,   setQrAmount]   = useState(0);
  const [confirming, setConfirming] = useState(false);

  // Table detail modal (request payment / refund / special instructions)
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(null);
  const [notesDraft,    setNotesDraft]    = useState("");
  const [savingNotes,   setSavingNotes]   = useState(false);
  const [payingCash,    setPayingCash]    = useState(false);
  const [refunding,     setRefunding]     = useState(false);

  useEffect(() => {
    adminApi.menu.getAll().then((r) => {
      setCategories(r.data);
      if (r.data.length > 0) setActiveCategory(r.data[0].id);
    });
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

  const activeItems = categories.find((c) => c.id === activeCategory)?.items ?? [];
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
    const allOptions = Object.values(itemOptions).flat();
    const unitPrice  = selectedItem.price + allOptions.reduce((s, o) => s + o.priceAdjustment, 0);
    pushItem(selectedItem, allOptions, unitPrice);
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const API = await resolveApiBase();
      const res = await fetch(`${API}/api/orders`, {
        method: "POST", headers: auth(),
        body: JSON.stringify({
          source: "POS", notes,
          items: cart.map((i) => ({
            menuItemId: i.menuItem.id, quantity: i.quantity,
            selectedOptions: i.selectedOptions.map((o) => ({ modifierOptionId: o.id })),
          })),
        }),
      });
      const { data: order } = await res.json();

      if (payMethod === "CASH") {
        await fetch(`${API}/api/payments/cash`, {
          method: "POST", headers: auth(),
          body: JSON.stringify({ orderId: order.id }),
        });
        toast.success(`Order #${order.id.slice(-4).toUpperCase()} — Cash paid ✓`);
        setCart([]); setNotes("");
      } else {
        // Show QR modal for cashier
        setQrMethod(payMethod);
        setQrAmount(total);
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
      const API = await resolveApiBase();
      await fetch(`${API}/api/payments/qr-confirm`, {
        method: "POST", headers: auth(),
        body: JSON.stringify({ orderId: qrOrderId, method: qrMethod }),
      });
      toast.success(`Order #${qrOrderId.slice(-4).toUpperCase()} — ${qrMethod} paid ✓`);
      setQrOrderId(null);
      setCart([]); setNotes("");
      setSelectedTable(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  }

  function openTable(table: CafeTable) {
    setSelectedTable(table);
    setNotesDraft(ordersByTable.get(table.id)?.[0]?.notes ?? "");
  }

  function requestPayment(order: Order, method: "GCASH" | "MAYA") {
    setQrMethod(method);
    setQrAmount(order.total);
    setQrOrderId(order.id);
  }

  async function requestCashPayment(order: Order) {
    setPayingCash(true);
    try {
      const API = await resolveApiBase();
      await fetch(`${API}/api/payments/cash`, {
        method: "POST", headers: auth(),
        body: JSON.stringify({ orderId: order.id }),
      });
      toast.success(`Order #${order.id.slice(-4).toUpperCase()} — Cash paid ✓`);
      setSelectedTable(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setPayingCash(false);
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

  return (
    <AdminLayout>
      <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* ── Menu panel ───────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 scrollbar-hide">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  activeCategory === cat.id ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {activeItems.map((item) => (
                <button key={item.id} onClick={() => addToCart(item)} disabled={!item.available}
                  className="rounded-xl bg-white border border-slate-200 p-4 text-left hover:border-slate-300 hover:shadow-sm transition active:scale-[0.97] disabled:opacity-40">
                  <p className="font-semibold text-slate-800 text-sm leading-tight">{item.name}</p>
                  {item.description && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.description}</p>}
                  <p className="mt-2 text-sm font-bold text-green-600">₱{(item.price / 100).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Cart panel ───────────────────────────────────────── */}
        <div className="flex w-72 flex-col border-l border-slate-200 bg-white">
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
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  <button
                    onClick={() => setCart((prev) => item.quantity <= 1 ? prev.filter((_, i) => i !== idx) : prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity - 1 } : it))}
                    className="h-6 w-6 rounded bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition text-sm flex items-center justify-center">
                    −
                  </button>
                  <span className="text-xs font-bold text-slate-800 w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => setCart((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                    className="h-6 w-6 rounded bg-slate-800 text-white font-bold hover:bg-slate-700 transition text-sm flex items-center justify-center">
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

            <div className="grid grid-cols-3 gap-1.5">
              {(["CASH", "GCASH", "MAYA"] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className={`rounded-lg border py-2 text-xs font-semibold transition ${
                    payMethod === m ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {m === "GCASH" ? "GCash" : m === "MAYA" ? "Maya" : "Cash"}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-xl font-bold text-slate-900">₱{(total / 100).toFixed(2)}</span>
            </div>

            <button onClick={placeOrder} disabled={cart.length === 0 || placing}
              className="w-full rounded-lg bg-[#0f172a] py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition">
              {placing ? "Placing…" : payMethod === "CASH" ? "Place Order (Cash)" : `Place Order → Show QR`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tables bar ───────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto border-t border-slate-200 bg-white px-4 py-2.5 scrollbar-hide">
        {sortedTables.map((table) => {
          const order = ordersByTable.get(table.id)?.[0];
          const count = ordersByTable.get(table.id)?.length ?? 0;
          const badge = tableBadge(order?.status);
          return (
            <button key={table.id} onClick={() => openTable(table)}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:shadow-sm ${badge.cls}`}>
              <span>{table.name}</span>
              <span className="opacity-70">· {badge.label}</span>
              {count > 1 && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
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
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                    <span className="text-sm text-slate-500">Total</span>
                    <span className="text-lg font-bold text-slate-900">₱{(selectedOrder.total / 100).toFixed(2)}</span>
                  </div>

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
                        <button onClick={() => requestCashPayment(selectedOrder)} disabled={payingCash}
                          className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 transition disabled:opacity-50">
                          {payingCash ? "…" : "Cash"}
                        </button>
                        <button onClick={() => requestPayment(selectedOrder, "GCASH")}
                          className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 transition">
                          GCash
                        </button>
                        <button onClick={() => requestPayment(selectedOrder, "MAYA")}
                          className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 transition">
                          Maya
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
                            +₱{(opt.priceAdjustment / 100).toFixed(2)}
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
              <p className="font-bold text-lg">{qrMethod === "GCASH" ? "GCash" : "Maya"} Payment</p>
              <p className="text-sm opacity-80 mt-0.5">
                Order #{qrOrderId.slice(-6).toUpperCase()} · ₱{(qrAmount / 100).toFixed(2)}
              </p>
            </div>

            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 mb-4">
                Ask customer to scan with their {qrMethod === "GCASH" ? "GCash" : "Maya"} app
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
    </AdminLayout>
  );
}
