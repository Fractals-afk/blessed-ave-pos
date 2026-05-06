"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/store/cart";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { QrPlaceholder } from "./QrPlaceholder";

interface Props {
  open: boolean;
  onClose: () => void;
  isTableOrder?: boolean;
}

const GCASH_QR = process.env.NEXT_PUBLIC_GCASH_QR_URL;
const MAYA_QR  = process.env.NEXT_PUBLIC_MAYA_QR_URL;

export function CartDrawer({ open, onClose, isTableOrder }: Props) {
  const router = useRouter();
  const { items, updateQuantity, clearCart, total, tableId, tableName } = useCart();
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [email,    setEmail]    = useState("");
  const [method,   setMethod]   = useState<"GCASH" | "MAYA" | "CASH">("GCASH");
  const [placing,  setPlacing]  = useState(false);

  // After order is placed — show QR screen
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const qrUrl = method === "GCASH" ? GCASH_QR : MAYA_QR;

  async function handleCheckout() {
    if (!isTableOrder && !name.trim()) {
      toast.error("Please enter your name", { icon: "👤" });
      return;
    }
    setPlacing(true);
    try {
      const orderRes = await api.orders.create({
        source: isTableOrder ? "QR_TABLE" : "ONLINE",
        tableId: isTableOrder ? tableId : undefined,
        customerName: name || undefined,
        customerPhone: phone || undefined,
        customerEmail: email || undefined,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          selectedOptions: i.selectedOptions.map((o) => ({ modifierOptionId: o.id })),
          notes: i.notes,
        })),
      });
      const orderId = orderRes.data.id;

      if (isTableOrder || method === "CASH") {
        clearCart();
        router.push(`/order/${orderId}?payment=cash`);
        return;
      }

      // GCash / Maya — show QR screen
      setQrOrderId(orderId);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setPlacing(false);
    }
  }

  function handleQrDone() {
    if (!qrOrderId) return;
    clearCart();
    router.push(`/order/${qrOrderId}?payment=pending`);
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-brown-900/50 backdrop-blur-sm" onClick={!qrOrderId ? onClose : undefined} />
      )}

      <div className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}>

        {/* ── QR payment screen ─────────────────────────────────── */}
        {qrOrderId ? (
          <>
            <div className={`text-white px-5 py-5 ${method === "GCASH" ? "bg-blue-600" : "bg-green-600"}`}>
              <p className="font-display font-bold text-xl">Scan to Pay</p>
              <p className="text-sm opacity-80 mt-0.5">
                {method === "GCASH" ? "GCash" : "Maya"} · ₱{(total() / 100).toFixed(2)}
              </p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="rounded-2xl border-4 border-slate-100 overflow-hidden shadow-md mb-4">
                {qrUrl
                  ? <img src={qrUrl} alt={`${method} QR`} className="w-64 h-64 object-contain" />
                  : <QrPlaceholder method={method} size={256} />
                }
              </div>
              <p className="text-sm text-slate-600 mb-1">
                Open your <strong>{method === "GCASH" ? "GCash" : "Maya"}</strong> app and scan
              </p>
              <p className="text-2xl font-bold text-slate-900 mb-1">₱{(total() / 100).toFixed(2)}</p>
              <p className="text-xs text-slate-400">Order #{qrOrderId.slice(-6).toUpperCase()}</p>

              <div className="mt-6 w-full space-y-2">
                <button
                  onClick={handleQrDone}
                  className={`w-full rounded-xl py-4 font-bold text-white transition active:scale-[0.98] ${
                    method === "GCASH" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  I've Paid — Track My Order
                </button>
                <p className="text-xs text-slate-400">
                  Your order is queued. The kitchen will prepare it once payment is verified.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* ── Normal cart screen ───────────────────────────────── */
          <>
            <div className="bg-brown-800 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-cream-100">
                  {isTableOrder ? tableName : "Your Cart"}
                </p>
                {itemCount > 0 && (
                  <p className="text-xs text-brown-300 mt-0.5">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                )}
              </div>
              <button onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brown-700 text-cream-200 hover:bg-brown-600 transition text-xl leading-none">
                ×
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                <div className="h-20 w-20 rounded-full bg-cream-200 flex items-center justify-center text-4xl mb-4">☕</div>
                <p className="font-display text-xl font-bold text-brown-700">Your cart is empty</p>
                <p className="text-brown-400 text-sm mt-1">Add something from the menu</p>
                <button onClick={onClose}
                  className="mt-5 rounded-full bg-brown-800 px-6 py-2.5 text-sm font-semibold text-cream-100 hover:bg-brown-700 transition">
                  Browse Menu
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 bg-cream-50 rounded-xl p-3 border border-cream-200">
                      <div className="flex-1">
                        <p className="font-semibold text-brown-800 text-sm">{item.menuItem.name}</p>
                        {item.selectedOptions.length > 0 && (
                          <p className="text-xs text-brown-400 mt-0.5">{item.selectedOptions.map((o) => o.name).join(", ")}</p>
                        )}
                        <p className="text-sm font-bold text-brown-700 mt-1">₱{(item.subtotal / 100).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-cream-200 text-brown-700 font-bold hover:bg-cream-300 transition text-base">
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-brown-800">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-brown-800 text-cream-100 font-bold hover:bg-brown-700 transition text-base">
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-cream-200 bg-cream-50 px-5 py-4 space-y-3">
                  {!isTableOrder && (
                    <>
                      <input type="text" placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-sm text-brown-700 placeholder-brown-300 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                      <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-sm text-brown-700 placeholder-brown-300 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                      <input type="email" placeholder="Email for receipt (optional)" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-sm text-brown-700 placeholder-brown-300 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                    </>
                  )}

                  {!isTableOrder && (
                    <div>
                      <p className="text-xs font-semibold text-brown-500 uppercase tracking-wider mb-2">Payment</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["GCASH", "MAYA", "CASH"] as const).map((m) => (
                          <button key={m} onClick={() => setMethod(m)}
                            className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
                              method === m
                                ? "border-gold-500 bg-gold-500/10 text-brown-800"
                                : "border-cream-200 bg-white text-brown-500 hover:border-brown-300"
                            }`}>
                            {m === "GCASH" ? "GCash" : m === "MAYA" ? "Maya" : "Cash"}
                          </button>
                        ))}
                      </div>
                      {(method === "GCASH" || method === "MAYA") && (
                        <p className="text-xs text-brown-400 mt-1.5 text-center">
                          QR code will appear after placing your order
                        </p>
                      )}
                    </div>
                  )}

                  {isTableOrder && (
                    <p className="text-center text-sm text-brown-400 bg-cream-200 rounded-xl py-2">
                      💳 Pay at the counter when you're done
                    </p>
                  )}

                  <div className="flex items-center justify-between font-bold">
                    <span className="text-brown-700">Total</span>
                    <span className="text-xl text-brown-800">₱{(total() / 100).toFixed(2)}</span>
                  </div>

                  <button onClick={handleCheckout} disabled={placing}
                    className="w-full rounded-xl bg-brown-800 py-3.5 font-semibold text-cream-100 shadow transition hover:bg-brown-700 active:scale-95 disabled:opacity-60">
                    {placing ? "Placing order..." : isTableOrder ? "📨 Send to Kitchen" : method === "CASH" ? "Place Order (Cash)" : `Place Order → Scan QR`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
