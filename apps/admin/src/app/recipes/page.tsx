"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { MenuCategory, MenuItem, InventoryItem } from "@blessed-ave/types";
import toast from "react-hot-toast";

const iCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition";
const lCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

type RecipeRow = {
  inventoryItemId: string;
  quantity: number;
};

type SavedRecipeRow = RecipeRow & {
  id: string;
  inventoryItem: InventoryItem;
};

export default function RecipesPage() {
  const [categories,   setCategories]   = useState<MenuCategory[]>([]);
  const [inventory,    setInventory]    = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipeRow[]>([]);
  const [draftRows,    setDraftRows]    = useState<RecipeRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [dirty,        setDirty]        = useState(false);

  useEffect(() => {
    Promise.all([adminApi.menu.getAll(), adminApi.inventory.list()])
      .then(([menuRes, invRes]) => {
        setCategories(menuRes.data);
        setInventory(invRes.data);
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  async function selectItem(item: MenuItem) {
    setSelectedItem(item);
    setDirty(false);
    try {
      const res = await adminApi.recipes.get(item.id);
      setSavedRecipes(res.data as SavedRecipeRow[]);
      setDraftRows(
        res.data.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity }))
      );
    } catch {
      setSavedRecipes([]);
      setDraftRows([]);
    }
  }

  function addRow() {
    setDraftRows((p) => [...p, { inventoryItemId: "", quantity: 0 }]);
    setDirty(true);
  }

  function removeRow(i: number) {
    setDraftRows((p) => p.filter((_, j) => j !== i));
    setDirty(true);
  }

  function updateRow(i: number, key: keyof RecipeRow, value: string | number) {
    setDraftRows((p) => {
      const rows = [...p];
      rows[i] = { ...rows[i], [key]: value };
      return rows;
    });
    setDirty(true);
  }

  async function save() {
    if (!selectedItem) return;
    const valid = draftRows.filter((r) => r.inventoryItemId && r.quantity > 0);
    setSaving(true);
    try {
      await adminApi.recipes.save(selectedItem.id, valid);
      toast.success("Recipe saved");
      const res = await adminApi.recipes.get(selectedItem.id);
      setSavedRecipes(res.data as SavedRecipeRow[]);
      setDraftRows(res.data.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity })));
      setDirty(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Flatten all items for the left panel
  const allItems: { cat: string; item: MenuItem }[] = categories.flatMap((c) =>
    (c.items ?? []).map((i) => ({ cat: c.name, item: i as MenuItem }))
  );

  // Compute COGS for this item
  const cogs = savedRecipes.reduce((sum, r) => {
    return sum + r.inventoryItem.cost * r.quantity;
  }, 0);
  const margin =
    selectedItem && cogs > 0
      ? (((selectedItem.price - cogs) / selectedItem.price) * 100).toFixed(1)
      : null;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="text-xl font-bold text-slate-900">Recipes</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Map ingredients to menu items so inventory auto-decrements on every sale
        </p>
      </div>

      {loading ? (
        <div className="p-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex h-[calc(100vh-73px)]">
          {/* ── Item list ─────────────────────────────────────────── */}
          <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
            <div className="p-3 space-y-3">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {cat.name}
                  </p>
                  {(cat.items ?? []).map((item) => {
                    const hasRecipe = false; // could pre-load counts later
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectItem(item as MenuItem)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition mb-0.5 ${
                          selectedItem?.id === item.id
                            ? "bg-white border border-slate-200 font-semibold text-slate-900 shadow-sm"
                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-1">
                          ₱{(item.price / 100).toFixed(0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {allItems.length === 0 && (
                <p className="px-3 py-4 text-xs text-slate-400">No menu items yet</p>
              )}
            </div>
          </aside>

          {/* ── Recipe editor ──────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedItem ? (
              <div className="max-w-2xl">
                {/* Item header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedItem.name}</h2>
                    <p className="text-xs text-slate-400">
                      Selling price: ₱{(selectedItem.price / 100).toFixed(2)}
                    </p>
                  </div>

                  {/* COGS summary */}
                  {savedRecipes.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">COGS</p>
                      <p className="text-sm font-bold text-slate-900">
                        ₱{(cogs / 100).toFixed(2)}
                      </p>
                      {margin !== null && (
                        <p className={`text-xs font-semibold ${parseFloat(margin) >= 60 ? "text-green-600" : parseFloat(margin) >= 30 ? "text-amber-600" : "text-red-500"}`}>
                          {margin}% margin
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Recipe rows */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingredients</span>
                    <button
                      onClick={addRow}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                    >
                      + Add ingredient
                    </button>
                  </div>

                  {draftRows.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                      No ingredients yet —{" "}
                      <button onClick={addRow} className="underline hover:text-slate-700 transition">
                        add one
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {draftRows.map((row, i) => {
                        const invItem = inventory.find((inv) => inv.id === row.inventoryItemId);
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1">
                              <label className={lCls}>Ingredient</label>
                              <select
                                className={iCls}
                                value={row.inventoryItemId}
                                onChange={(e) => updateRow(i, "inventoryItemId", e.target.value)}
                              >
                                <option value="">— select —</option>
                                {inventory.map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.name} ({inv.unit})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="w-28">
                              <label className={lCls}>Qty used</label>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                className={iCls}
                                value={row.quantity}
                                onChange={(e) => updateRow(i, "quantity", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            {invItem && (
                              <div className="w-20 pt-5 text-xs text-slate-400 text-right">
                                {invItem.unit}
                                {invItem.cost > 0 && (
                                  <div className="text-slate-500 font-medium">
                                    ₱{((invItem.cost * row.quantity) / 100).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => removeRow(i)}
                              className="pt-5 text-slate-300 hover:text-red-500 transition text-xl leading-none flex-shrink-0"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Inventory auto-decrements when an order is confirmed
                  </p>
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="rounded-lg bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save Recipe"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Select a menu item to define its recipe
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
