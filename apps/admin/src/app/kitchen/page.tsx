"use client";

import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { Order } from "@blessed-ave/types";
import toast from "react-hot-toast";
import clsx from "clsx";

const STATUS_BORDER: Record<string, string> = {
  PENDING:   "border-l-amber-400",
  CONFIRMED: "border-l-blue-400",
  PREPARING: "border-l-violet-400",
  READY:     "border-l-green-400",
};

const STATUS_ACTIONS: Record<string, { next: string; label: string; color: string }> = {
  PENDING:   { next: "CONFIRMED", label: "Confirm",        color: "bg-blue-600 hover:bg-blue-500"   },
  CONFIRMED: { next: "PREPARING", label: "Start Prep",     color: "bg-violet-600 hover:bg-violet-500" },
  PREPARING: { next: "READY",     label: "Mark Ready 🔔",  color: "bg-green-600 hover:bg-green-500" },
  READY:     { next: "COLLECTED", label: "Collected ✓",    color: "bg-slate-600 hover:bg-slate-500" },
};

const COLS = [
  { key: "PENDING",   label: "New",       dot: "bg-amber-400"  },
  { key: "CONFIRMED", label: "Confirmed", dot: "bg-blue-400"   },
  { key: "PREPARING", label: "Preparing", dot: "bg-violet-400" },
  { key: "READY",     label: "Ready",     dot: "bg-green-400"  },
];

function elapsed(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return mins < 1 ? "just now" : `${mins}m ago`;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    adminApi.orders.kitchen().then((r) => setOrders(r.data));
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
    socket.emit("join:kitchen");
    socket.on("order:new", (order: Order) => {
      setOrders((prev) => [order, ...prev]);
      toast("🔔 New order!", { duration: 4000 });
      audioRef.current?.play().catch(() => {});
    });
    socket.on("order:updated", ({ order }: { order: Order }) => {
      setOrders((prev) =>
        ["COLLECTED", "CANCELLED"].includes(order.status)
          ? prev.filter((o) => o.id !== order.id)
          : prev.map((o) => (o.id === order.id ? order : o))
      );
    });
    return () => { socket.disconnect(); };
  }, []);

  async function advance(order: Order) {
    const action = STATUS_ACTIONS[order.status];
    if (!action) return;
    try { await adminApi.orders.updateStatus(order.id, action.next); }
    catch (err: any) { toast.error(err.message); }
  }

  const cols = COLS.map((c) => ({ ...c, orders: orders.filter((o) => o.status === c.key) }));

  return (
    <AdminLayout>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kitchen Display</h1>
          <p className="text-xs text-slate-400 mt-0.5">Live order board</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-green-600">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>

      <div className="p-6">
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-4xl mb-3">😌</div>
            <p className="font-semibold text-slate-700">No active orders</p>
            <p className="text-sm text-slate-400 mt-1">Orders will appear here as they come in</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-4">
          {cols.map((col) => (
            <div key={col.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h2 className="text-sm font-semibold text-slate-700">{col.label}</h2>
                {col.orders.length > 0 && (
                  <span className="ml-auto text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                    {col.orders.length}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {col.orders.map((order) => {
                  const ageMin = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                  return (
                    <div key={order.id}
                      className={clsx(
                        "rounded-xl bg-white border border-slate-200 border-l-4 p-3.5 shadow-sm",
                        STATUS_BORDER[order.status],
                        ageMin >= 10 && "ring-2 ring-red-200"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            #{order.id.slice(-4).toUpperCase()}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {order.source === "QR_TABLE" ? `📍 ${order.tableName ?? "Table"}`
                              : order.source === "POS" ? "🖥️ POS"
                              : "🌐 Online"}
                            {" · "}{elapsed(order.createdAt)}
                          </p>
                        </div>
                        {ageMin >= 10 && (
                          <span className="text-xs font-bold text-red-500">{ageMin}m ⚠️</span>
                        )}
                      </div>

                      <ul className="space-y-1 mb-3">
                        {order.items.map((item) => (
                          <li key={item.id} className="text-xs">
                            <span className="font-semibold text-slate-800">
                              {item.quantity}× {item.menuItemName}
                            </span>
                            {item.selectedOptions.length > 0 && (
                              <p className="text-slate-400 ml-3">{item.selectedOptions.map((o) => o.name).join(", ")}</p>
                            )}
                            {item.notes && (
                              <p className="text-amber-600 ml-3 italic">✎ {item.notes}</p>
                            )}
                          </li>
                        ))}
                      </ul>

                      {STATUS_ACTIONS[order.status] && (
                        <button onClick={() => advance(order)}
                          className={`w-full rounded-lg py-1.5 text-xs font-semibold text-white transition ${STATUS_ACTIONS[order.status].color}`}>
                          {STATUS_ACTIONS[order.status].label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
