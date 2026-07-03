"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { Order, OrderStatus } from "@blessed-ave/types";
import toast from "react-hot-toast";
import clsx from "clsx";

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-violet-100 text-violet-700",
  READY:     "bg-green-100 text-green-700",
  COLLECTED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-100 text-red-600",
};

const STATUS_OPTIONS: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COLLECTED", "CANCELLED"];
const SOURCE_OPTIONS = ["ONLINE", "QR_TABLE", "POS"];

const php = (c: number) => `₱${(c / 100).toFixed(2)}`;

function sourceLabel(order: Order) {
  if (order.source === "QR_TABLE") return `📍 ${order.table?.name ?? "Table"}`;
  if (order.source === "POS") return "🖥️ POS";
  return "🌐 Online";
}

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState("");
  const [source, setSource]   = useState("");
  const [date, setDate]       = useState("");
  const [detail, setDetail]   = useState<Order | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (source) params.source = source;
      if (date) params.date = date;
      const res = await adminApi.orders.list(params);
      setOrders(res.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, source, date]);

  async function updateStatus(order: Order, next: OrderStatus) {
    try {
      const res = await adminApi.orders.updateStatus(order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? (res.data as Order) : o)));
      setDetail((d) => (d && d.id === order.id ? (res.data as Order) : d));
      toast.success(`Order marked ${next.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout>
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Orders</h1>
          <p className="text-xs text-slate-400 mt-0.5">All orders across POS, online, and table QR</p>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap gap-3 mb-5">
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500" />
          {(status || source || date) && (
            <button onClick={() => { setStatus(""); setSource(""); setDate(""); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition">
              Clear
            </button>
          )}
        </div>

        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} onClick={() => setDetail(order)}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition">
                  <td className="px-4 py-3 font-bold text-slate-900">#{order.id.slice(-6).toUpperCase()}</td>
                  <td className="px-4 py-3 text-slate-500">{sourceLabel(order)}</td>
                  <td className="px-4 py-3 text-slate-500">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-md px-2 py-0.5 text-xs font-semibold", STATUS_BADGE[order.status])}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{php(order.total)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{new Date(order.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-semibold text-slate-700">No orders found</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting the filters above</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">#{detail.id.slice(-6).toUpperCase()}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{sourceLabel(detail)} · {new Date(detail.createdAt).toLocaleString("en-PH")}</p>
              </div>
              <span className={clsx("rounded-md px-2 py-0.5 text-xs font-semibold", STATUS_BADGE[detail.status])}>
                {detail.status}
              </span>
            </div>

            {(detail.customerName || detail.customerPhone) && (
              <div className="mb-4 text-sm text-slate-600">
                {detail.customerName && <p>{detail.customerName}</p>}
                {detail.customerPhone && <p className="text-slate-400">{detail.customerPhone}</p>}
              </div>
            )}

            <ul className="space-y-2 mb-4">
              {detail.items.map((item) => (
                <li key={item.id} className="text-sm border-b border-slate-50 pb-2 last:border-0">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-800">{item.quantity}× {item.menuItemName}</span>
                    <span className="text-slate-600">{php(item.subtotal)}</span>
                  </div>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">{item.selectedOptions.map((o) => o.name).join(", ")}</p>
                  )}
                  {item.notes && <p className="text-xs text-amber-600 italic mt-0.5">✎ {item.notes}</p>}
                </li>
              ))}
            </ul>

            <div className="flex justify-between text-sm font-bold text-slate-900 mb-5">
              <span>Total</span>
              <span>{php(detail.total)}</span>
            </div>

            {!["COLLECTED", "CANCELLED"].includes(detail.status) && (
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.filter((s) => s !== detail.status && s !== "PENDING" && s !== "CONFIRMED").map((s) => (
                  <button key={s} onClick={() => updateStatus(detail, s)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                    Mark {s}
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => setDetail(null)}
              className="mt-4 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              Close
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
