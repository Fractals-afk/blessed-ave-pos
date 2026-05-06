"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { MenuCategory, MenuItem, ModifierGroup } from "@blessed-ave/types";
import toast from "react-hot-toast";

const iCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition";
const lCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(centavos: number) {
  return `₱${(centavos / 100).toFixed(2)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemFormState = {
  name: string;
  description: string;
  price: string; // pesos string for input
  imageUrl: string;
  available: boolean;
  categoryId: string;
};

type ModifierDraft = {
  name: string;
  required: boolean;
  multiSelect: boolean;
  options: { name: string; priceAdjustment: string }[];
};

const emptyItem = (categoryId: string): ItemFormState => ({
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  available: true,
  categoryId,
});

const emptyModifier = (): ModifierDraft => ({
  name: "",
  required: false,
  multiSelect: false,
  options: [{ name: "", priceAdjustment: "0" }],
});

// ─────────────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  // Category modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", description: "", active: true });
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);

  // Item modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItem(""));
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // Modifier modal (nested inside item view)
  const [showModModal, setShowModModal] = useState(false);
  const [modForm, setModForm] = useState<ModifierDraft>(emptyModifier());
  const [modTargetItemId, setModTargetItemId] = useState<string | null>(null);
  const [savingMod, setSavingMod] = useState(false);

  async function load() {
    try {
      const res = await adminApi.menu.getAll();
      setCategories(res.data);
      if (res.data.length && !activeCatId) setActiveCatId(res.data[0].id);
    } catch {
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Category CRUD ─────────────────────────────────────────────────────────

  function openAddCat() {
    setEditCat(null);
    setCatForm({ name: "", description: "", active: true });
    setShowCatModal(true);
  }

  function openEditCat(cat: MenuCategory) {
    setEditCat(cat);
    setCatForm({ name: cat.name, description: cat.description ?? "", active: cat.active });
    setShowCatModal(true);
  }

  async function saveCategory() {
    try {
      if (editCat) {
        await adminApi.menu.updateCategory(editCat.id, catForm);
        toast.success("Category updated");
      } else {
        await adminApi.menu.createCategory(catForm);
        toast.success("Category created");
      }
      setShowCatModal(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function deleteCategory(cat: MenuCategory) {
    if (!confirm(`Delete category "${cat.name}"? All items inside will also be deleted.`)) return;
    try {
      await adminApi.menu.deleteCategory(cat.id);
      toast.success("Category deleted");
      if (activeCatId === cat.id) setActiveCatId(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  function openAddItem() {
    if (!activeCatId) return;
    setEditItem(null);
    setItemForm(emptyItem(activeCatId));
    setShowItemModal(true);
  }

  function openEditItem(item: MenuItem) {
    setEditItem(item);
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: (item.price / 100).toFixed(2),
      imageUrl: item.imageUrl ?? "",
      available: item.available,
      categoryId: item.categoryId,
    });
    setShowItemModal(true);
  }

  async function saveItem() {
    setSavingItem(true);
    try {
      const body = {
        ...itemForm,
        price: Math.round(parseFloat(itemForm.price || "0") * 100),
        imageUrl: itemForm.imageUrl || undefined,
        description: itemForm.description || undefined,
      };
      if (editItem) {
        await adminApi.menu.updateItem(editItem.id, body);
        toast.success("Item updated");
      } else {
        await adminApi.menu.createItem(body);
        toast.success("Item created");
      }
      setShowItemModal(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingItem(false);
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await adminApi.menu.deleteItem(item.id);
      toast.success("Item deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function toggleAvailable(item: MenuItem) {
    try {
      await adminApi.menu.updateItem(item.id, { available: !item.available });
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // ── Modifier CRUD ──────────────────────────────────────────────────────────

  function openAddModifier(itemId: string) {
    setModTargetItemId(itemId);
    setModForm(emptyModifier());
    setShowModModal(true);
  }

  async function saveModifier() {
    if (!modTargetItemId) return;
    setSavingMod(true);
    try {
      await adminApi.menu.createModifierGroup({
        menuItemId: modTargetItemId,
        name: modForm.name,
        required: modForm.required,
        multiSelect: modForm.multiSelect,
        options: modForm.options.map((o) => ({
          name: o.name,
          priceAdjustment: Math.round(parseFloat(o.priceAdjustment || "0") * 100),
        })),
      });
      toast.success("Modifier group added");
      setShowModModal(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingMod(false);
    }
  }

  async function deleteModifierGroup(group: ModifierGroup) {
    if (!confirm(`Delete modifier group "${group.name}"?`)) return;
    try {
      await adminApi.menu.deleteModifierGroup(group.id);
      toast.success("Modifier group removed");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const activeCat = categories.find((c) => c.id === activeCatId) ?? null;
  const activeItems: MenuItem[] = (activeCat?.items as MenuItem[] | undefined) ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Menu</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {categories.length} categories · {categories.reduce((n, c) => n + (c.items?.length ?? 0), 0)} items
          </p>
        </div>
        <button
          onClick={openAddCat}
          className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          + Category
        </button>
      </div>

      {loading ? (
        <div className="p-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex h-[calc(100vh-73px)]">
          {/* ── Category sidebar ────────────────────────────────────── */}
          <aside className="w-56 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
            <div className="p-3 space-y-0.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCatId(cat.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-left transition ${
                    activeCatId === cat.id
                      ? "bg-white border border-slate-200 font-semibold text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="ml-2 flex-shrink-0 text-xs text-slate-400">
                    {cat.items?.length ?? 0}
                  </span>
                </button>
              ))}
              {categories.length === 0 && (
                <p className="px-3 py-4 text-xs text-slate-400">No categories yet</p>
              )}
            </div>
          </aside>

          {/* ── Items panel ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {activeCat ? (
              <div className="p-6">
                {/* Category header row */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{activeCat.name}</h2>
                    {activeCat.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{activeCat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        activeCat.active
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {activeCat.active ? "Active" : "Hidden"}
                    </span>
                    <button
                      onClick={() => openEditCat(activeCat)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCategory(activeCat)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={openAddItem}
                      className="rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      + Item
                    </button>
                  </div>
                </div>

                {/* Item cards */}
                {activeItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
                    <p className="text-slate-400 text-sm">No items in this category</p>
                    <button
                      onClick={openAddItem}
                      className="mt-3 text-xs font-semibold text-slate-500 underline hover:text-slate-900 transition"
                    >
                      Add the first item
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {activeItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={() => openEditItem(item)}
                        onDelete={() => deleteItem(item)}
                        onToggle={() => toggleAvailable(item)}
                        onAddModifier={() => openAddModifier(item.id)}
                        onDeleteModifier={deleteModifierGroup}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Select a category
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Category Modal ─────────────────────────────────────────── */}
      {showCatModal && (
        <Modal title={editCat ? "Edit Category" : "Add Category"} onClose={() => setShowCatModal(false)}>
          <div className="space-y-3">
            <div>
              <label className={lCls}>Name</label>
              <input
                className={iCls}
                value={catForm.name}
                onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={lCls}>Description (optional)</label>
              <input
                className={iCls}
                value={catForm.description}
                onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={catForm.active}
                onChange={(e) => setCatForm((p) => ({ ...p, active: e.target.checked }))}
                className="rounded"
              />
              Visible to customers
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowCatModal(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
            <button onClick={saveCategory} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Save</button>
          </div>
        </Modal>
      )}

      {/* ── Item Modal ─────────────────────────────────────────────── */}
      {showItemModal && (
        <Modal title={editItem ? "Edit Item" : "Add Item"} onClose={() => setShowItemModal(false)} wide>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lCls}>Name</label>
                <input className={iCls} value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className={lCls}>Price (₱)</label>
                <input type="number" min="0" step="0.01" className={iCls} value={itemForm.price} onChange={(e) => setItemForm((p) => ({ ...p, price: e.target.value }))} />
              </div>
              <div>
                <label className={lCls}>Category</label>
                <select className={iCls} value={itemForm.categoryId} onChange={(e) => setItemForm((p) => ({ ...p, categoryId: e.target.value }))}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lCls}>Description (optional)</label>
                <input className={iCls} value={itemForm.description} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={lCls}>Image URL (optional)</label>
                <input className={iCls} placeholder="https://…" value={itemForm.imageUrl} onChange={(e) => setItemForm((p) => ({ ...p, imageUrl: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={itemForm.available} onChange={(e) => setItemForm((p) => ({ ...p, available: e.target.checked }))} className="rounded" />
              Available for ordering
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowItemModal(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
            <button onClick={saveItem} disabled={savingItem} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-60">
              {savingItem ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modifier Modal ─────────────────────────────────────────── */}
      {showModModal && (
        <Modal title="Add Modifier Group" onClose={() => setShowModModal(false)} wide>
          <div className="space-y-4">
            <div>
              <label className={lCls}>Group name (e.g. Size, Milk Type)</label>
              <input className={iCls} value={modForm.name} onChange={(e) => setModForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={modForm.required} onChange={(e) => setModForm((p) => ({ ...p, required: e.target.checked }))} className="rounded" />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={modForm.multiSelect} onChange={(e) => setModForm((p) => ({ ...p, multiSelect: e.target.checked }))} className="rounded" />
                Multi-select
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={lCls + " mb-0"}>Options</label>
                <button
                  onClick={() => setModForm((p) => ({ ...p, options: [...p.options, { name: "", priceAdjustment: "0" }] }))}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                >
                  + Add option
                </button>
              </div>
              <div className="space-y-2">
                {modForm.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      placeholder="Option name"
                      className={iCls + " flex-1"}
                      value={opt.name}
                      onChange={(e) => setModForm((p) => {
                        const options = [...p.options];
                        options[i] = { ...options[i], name: e.target.value };
                        return { ...p, options };
                      })}
                    />
                    <input
                      type="number"
                      placeholder="₱ adj"
                      step="0.01"
                      className={iCls + " w-24"}
                      value={opt.priceAdjustment}
                      onChange={(e) => setModForm((p) => {
                        const options = [...p.options];
                        options[i] = { ...options[i], priceAdjustment: e.target.value };
                        return { ...p, options };
                      })}
                    />
                    {modForm.options.length > 1 && (
                      <button
                        onClick={() => setModForm((p) => ({ ...p, options: p.options.filter((_, j) => j !== i) }))}
                        className="text-slate-400 hover:text-red-500 transition text-lg leading-none flex-shrink-0"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowModModal(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
            <button onClick={saveModifier} disabled={savingMod} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-60">
              {savingMod ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`w-full ${wide ? "max-w-lg" : "max-w-sm"} rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
  onToggle,
  onAddModifier,
  onDeleteModifier,
}: {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onAddModifier: () => void;
  onDeleteModifier: (g: ModifierGroup) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Image */}
      {item.imageUrl && (
        <div className="h-32 bg-slate-100 overflow-hidden">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
            {item.description && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
            )}
          </div>
          <span className="text-sm font-bold text-slate-700 flex-shrink-0">
            {fmt(item.price)}
          </span>
        </div>

        {/* Availability toggle */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onToggle}
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border transition ${
              item.available
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
            }`}
          >
            {item.available ? "Available" : "Hidden"}
          </button>
          <div className="flex gap-1">
            <button onClick={onEdit} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition">Edit</button>
            <button onClick={onDelete} className="rounded-md px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-50 transition">Delete</button>
          </div>
        </div>

        {/* Modifier groups */}
        {(item.modifierGroups?.length ?? 0) > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            {item.modifierGroups!.map((g) => (
              <div key={g.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-700">{g.name}</span>
                  {g.required && <span className="ml-1 text-[10px] text-red-500">required</span>}
                  <p className="text-[10px] text-slate-400">{g.options.map((o) => o.name).join(", ")}</p>
                </div>
                <button
                  onClick={() => onDeleteModifier(g)}
                  className="text-slate-300 hover:text-red-500 transition text-base leading-none flex-shrink-0 ml-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onAddModifier}
          className="mt-2 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-400 hover:text-slate-600 transition"
        >
          + Add modifier group
        </button>
      </div>
    </div>
  );
}
