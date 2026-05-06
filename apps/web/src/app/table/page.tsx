"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCart } from "@/store/cart";
import type { MenuCategory } from "@blessed-ave/types";
import { MenuCategorySection } from "@/components/MenuCategorySection";
import { CartDrawer } from "@/components/CartDrawer";

function TableOrderInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tableName, setTableName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const setTable = useCart((s) => s.setTable);
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.total);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    if (!token) { setError("No table token provided."); setLoading(false); return; }
    Promise.all([api.tables.getByToken(token), api.menu.getAll()])
      .then(([tableRes, menuRes]) => {
        setTableName(tableRes.data.name);
        setTable(tableRes.data.id, tableRes.data.name);
        setCategories(menuRes.data);
        if (menuRes.data.length > 0) setActiveCategory(menuRes.data[0].id);
      })
      .catch(() => setError("This QR code is no longer valid."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
          <p className="text-brown-400 text-sm">Loading table menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="font-display text-2xl font-bold text-brown-800">Invalid QR Code</h1>
          <p className="mt-2 text-brown-400">{error}</p>
          <p className="mt-1 text-brown-400">Please ask a staff member for help.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-30 bg-brown-800 shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-500 bg-brown-700">
              <span className="font-display text-lg font-black text-cream-200">B</span>
            </div>
            <div>
              <p className="font-display font-bold text-cream-100 leading-none">Blessed Ave.</p>
              <p className="text-xs text-gold-400 font-semibold leading-none mt-0.5">📍 {tableName}</p>
            </div>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-brown-900 shadow transition hover:bg-gold-400 active:scale-95"
          >
            <span>🛒</span>
            {itemCount > 0 ? (
              <span>{itemCount} item{itemCount !== 1 ? "s" : ""} · ₱{(total() / 100).toFixed(2)}</span>
            ) : (
              <span>Cart</span>
            )}
          </button>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeCategory === cat.id
                  ? "bg-gold-500 text-brown-800"
                  : "bg-brown-700 text-brown-200 hover:bg-brown-600"
              }`}
            >
              {cat.name}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-brown-800">
            Order to {tableName}
          </h1>
          <p className="mt-1 text-brown-500">Your order goes straight to the kitchen ☕</p>
        </div>

        <div className="space-y-14">
          {categories.map((cat) => (
            <MenuCategorySection key={cat.id} category={cat} />
          ))}
        </div>
      </main>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} isTableOrder />
    </div>
  );
}

export default function TableOrderPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
      </div>
    }>
      <TableOrderInner />
    </Suspense>
  );
}
