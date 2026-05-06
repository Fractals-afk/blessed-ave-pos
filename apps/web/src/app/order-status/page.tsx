"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Order } from "@blessed-ave/types";
import { io } from "socket.io-client";

const STATUS_STEPS = ["CONFIRMED", "PREPARING", "READY", "COLLECTED"] as const;
const STATUS_LABELS: Record<string, string> = {
  PENDING:   "Order Received",
  CONFIRMED: "Order Confirmed",
  PREPARING: "Being Prepared",
  READY:     "Ready for Pickup!",
  COLLECTED: "Collected — Enjoy!",
  CANCELLED: "Cancelled",
};
const STATUS_EMOJI: Record<string, string> = {
  PENDING:   "🕐",
  CONFIRMED: "✅",
  PREPARING: "👨‍🍳",
  READY:     "🔔",
  COLLECTED: "😊",
  CANCELLED: "❌",
};

function OrderStatusInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const paymentResult = searchParams.get("payment");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    api.orders.getById(id).then((r) => {
      setOrder(r.data);
      setLoading(false);
    });

    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
    socket.emit("join:order", id);
    socket.on("order:updated", ({ order: updatedOrder }: { order: Order }) => {
      setOrder(updatedOrder);
    });
    return () => { socket.disconnect(); };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 px-6">
        <p className="text-brown-400">Order not found.</p>
      </div>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(order.status as any);

  return (
    <div className="min-h-screen bg-cream-100 px-4 py-12">
      <div className="mx-auto max-w-md mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-500 bg-brown-800">
          <span className="font-display text-lg font-black text-cream-200">B</span>
        </div>
        <div>
          <p className="font-display font-bold text-brown-800 leading-none">Blessed Ave.</p>
          <p className="text-xs text-brown-400 leading-none mt-0.5">Order Status</p>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        <div className="text-center">
          <div className="text-6xl">{STATUS_EMOJI[order.status] ?? "🕐"}</div>
          <h1 className="mt-4 font-display text-3xl font-bold text-brown-800">
            {STATUS_LABELS[order.status] ?? order.status}
          </h1>
          <p className="mt-2 text-brown-400">Order #{order.id.slice(-6).toUpperCase()}</p>

          {paymentResult === "success" && order.status !== "CANCELLED" && (
            <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm font-medium">
              Payment confirmed ✓
            </div>
          )}
          {paymentResult === "cash" && order.status !== "CANCELLED" && (
            <div className="mt-4 rounded-xl bg-gold-500/10 border border-gold-500/30 px-4 py-3 text-brown-700 text-sm font-medium">
              💳 Pay at the counter when you collect your order
            </div>
          )}
        </div>

        {order.status !== "CANCELLED" && (
          <div className="mt-10 flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 items-center">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i <= currentStep
                    ? "bg-brown-800 text-gold-400"
                    : "bg-cream-200 text-brown-400"
                }`}>
                  {i < currentStep ? "✓" : i + 1}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 transition-colors ${
                    i < currentStep ? "bg-brown-800" : "bg-cream-200"
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        {order.status !== "CANCELLED" && (
          <div className="mt-2 flex justify-between text-[10px] text-brown-400 px-0.5">
            {["Confirmed", "Preparing", "Ready", "Done"].map((label) => (
              <span key={label} className="text-center w-9 flex-shrink-0">{label}</span>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-2xl bg-white p-5 shadow-sm border border-cream-200">
          <h2 className="font-semibold text-brown-800 mb-4">Your order</h2>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-brown-700">
                  {item.quantity}× {item.menuItemName}
                  {item.selectedOptions.length > 0 && (
                    <span className="text-brown-400">
                      {" "}({item.selectedOptions.map((o) => o.name).join(", ")})
                    </span>
                  )}
                </span>
                <span className="font-medium text-brown-800">₱{(item.subtotal / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-cream-200 pt-4 flex justify-between font-bold">
            <span className="text-brown-700">Total</span>
            <span className="text-gold-600">₱{(order.total / 100).toFixed(2)}</span>
          </div>
        </div>

        <a href="/"
          className="mt-6 block text-center text-sm text-brown-400 hover:text-brown-700 transition">
          ← Back to Blessed Ave.
        </a>
      </div>
    </div>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
      </div>
    }>
      <OrderStatusInner />
    </Suspense>
  );
}
