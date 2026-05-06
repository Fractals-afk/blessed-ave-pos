"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { InventoryItem } from "@blessed-ave/types";
import toast from "react-hot-toast";

const iCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition";
const lCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

export default function InventoryPage() {
  const [items,        setItems]        = useState<InventoryItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showAdd,      setShowAdd]      = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [search,       setSearch]       = useState("");
  const [form, setForm] = useState({ name: "", unit: "PCS", currentStock: 0, lowStockThreshold: 0, cost: 0 });
  const [adjustQty,    setAdjustQty]    = useState(0);
  const [adjustReason, setAdjustReason] = useState<"PURCHASE" | "WASTE" | "ADJUSTMENT">("PURCHASE");
  const [adjustNotes,  setAdjustNotes]  = useState("");

  async function load() {
    const res = await adminApi.inventory.list();
    setItems(res.data); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    try {
      await adminApi.inventory.create({ ...form, cost: Math.round(form.cost * 100) });
      toast.success("Item added"); setShowAdd(false); load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleAdjust() {
    if (!adjustTarget) return;
    try {
      await adminApi.inventory.adjust(adjustTarget.id, { quantity: adjustQty, reason: adjustReason, notes: adjustNotes });
      toast.success("Stock updated"); setAdjustTarget(null); load();
    } catch (err: any) { toast.error(err.message); }
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowCount = items.filter((i) => i.isLow).length;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {items.length} items{lowCount > 0 && <span className="text-red-500 ml-1">· {lowCount} low stock</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
          + Add Item
        </button>
      </div>

      <div className="p-6">
        <input type="text" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : (
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{["Item", "Stock", "Unit", "Threshold", "Cost/unit", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className={`px-4 py-3 font-bold ${item.isLow ? "text-red-600" : "text-slate-700"}`}>{item.currentStock}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                    <td className="px-4 py-3 text-slate-500">{item.lowStockThreshold}</td>
                    <td className="px-4 py-3 text-slate-500">{item.cost ? `₱${(item.cost / 100).toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-3">
                      {item.isLow
                        ? <span className="rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-600">Low</span>
                        : <span className="rounded-md bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">OK</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setAdjustTarget(item); setAdjustQty(0); setAdjustNotes(""); }}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition">Adjust</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 mx-4">
            <h3 className="font-bold text-slate-900 mb-5">Add Inventory Item</h3>
            <div className="space-y-3">
              {[{ label: "Name", key: "name", type: "text" }, { label: "Current Stock", key: "currentStock", type: "number" }, { label: "Low Stock Threshold", key: "lowStockThreshold", type: "number" }, { label: "Cost per unit (₱)", key: "cost", type: "number" }].map((f) => (
                <div key={f.key}>
                  <label className={lCls}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                    className={iCls} />
                </div>
              ))}
              <div>
                <label className={lCls}>Unit</label>
                <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} className={iCls}>
                  {["KG","G","L","ML","PCS","PACK","BOTTLE"].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleAdd} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 mx-4">
            <h3 className="font-bold text-slate-900">Adjust: {adjustTarget.name}</h3>
            <p className="text-sm text-slate-400 mt-0.5 mb-5">Current: {adjustTarget.currentStock} {adjustTarget.unit}</p>
            <div className="space-y-3">
              <div><label className={lCls}>Quantity change</label><input type="number" value={adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} className={iCls} /></div>
              <div><label className={lCls}>Reason</label>
                <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value as any)} className={iCls}>
                  <option value="PURCHASE">Purchase / Restock</option>
                  <option value="WASTE">Waste / Spoilage</option>
                  <option value="ADJUSTMENT">Manual Adjustment</option>
                </select>
              </div>
              <div><label className={lCls}>Notes (optional)</label><input type="text" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} className={iCls} /></div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setAdjustTarget(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleAdjust} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Save</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
