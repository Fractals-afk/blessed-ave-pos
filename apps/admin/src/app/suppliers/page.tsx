"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { Supplier } from "@blessed-ave/types";
import toast from "react-hot-toast";

const iCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition";
const lCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

const EMPTY_FORM = { name: "", contactName: "", phone: "", email: "", notes: "" };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [search,    setSearch]    = useState("");
  const [form,      setForm]      = useState(EMPTY_FORM);

  async function load() {
    try {
      const res = await adminApi.suppliers.list();
      setSuppliers(res.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    try {
      const body: Record<string, string> = { name: form.name.trim() };
      if (form.contactName.trim()) body.contactName = form.contactName.trim();
      if (form.phone.trim())       body.phone       = form.phone.trim();
      if (form.email.trim())       body.email       = form.email.trim();
      if (form.notes.trim())       body.notes       = form.notes.trim();
      await adminApi.suppliers.create(body);
      toast.success("Supplier added");
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-xs text-slate-400 mt-0.5">{suppliers.length} suppliers</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
          + Add Supplier
        </button>
      </div>

      <div className="p-6">
        <input type="text" placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400">
            {suppliers.length === 0 ? "No suppliers yet. Add your first supplier to get started." : "No suppliers match your search."}
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{["Name", "Contact", "Phone", "Email", "Notes"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.contactName || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.notes || "—"}</td>
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
            <h3 className="font-bold text-slate-900 mb-5">Add Supplier</h3>
            <div className="space-y-3">
              {[
                { label: "Name", key: "name", type: "text" },
                { label: "Contact Name", key: "contactName", type: "text" },
                { label: "Phone", key: "phone", type: "text" },
                { label: "Email", key: "email", type: "email" },
                { label: "Notes", key: "notes", type: "text" },
              ].map((f) => (
                <div key={f.key}>
                  <label className={lCls}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className={iCls} />
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleAdd} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Add</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
