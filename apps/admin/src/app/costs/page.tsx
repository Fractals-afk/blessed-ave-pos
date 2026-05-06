"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import toast from "react-hot-toast";
import { format } from "date-fns";

const CATEGORIES  = ["RENT","UTILITIES","WAGES","PACKAGING","MARKETING","EQUIPMENT","MAINTENANCE","OTHER"];
const FREQUENCIES = ["ONE_TIME","DAILY","WEEKLY","MONTHLY","YEARLY"];
const ICONS: Record<string, string> = { RENT:"🏠",UTILITIES:"💡",WAGES:"👥",PACKAGING:"📦",MARKETING:"📣",EQUIPMENT:"🔧",MAINTENANCE:"🛠️",OTHER:"📝" };
const iCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition";
const lCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

interface Cost { id: string; name: string; category: string; frequency: string; amount: number; date: string; notes?: string }

export default function CostsPage() {
  const [costs,   setCosts]   = useState<Cost[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [from, setFrom] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [form, setForm] = useState({ name:"", category:"RENT", frequency:"MONTHLY", amount:"", date:format(new Date(),"yyyy-MM-dd"), notes:"" });

  async function load() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/operating-costs?from=${from}&to=${to}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } });
    const json = await res.json(); setCosts(json.data ?? []);
  }
  useEffect(() => { load(); }, [from, to]);

  async function handleAdd() {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/operating-costs`, { method:"POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("accessToken")}` },
        body: JSON.stringify({ ...form, amount: Math.round(Number(form.amount) * 100) }) });
      toast.success("Cost added"); setShowAdd(false);
      setForm({ name:"", category:"RENT", frequency:"MONTHLY", amount:"", date:format(new Date(),"yyyy-MM-dd"), notes:"" });
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this cost?")) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/operating-costs/${id}`,
      { method:"DELETE", headers:{ Authorization:`Bearer ${localStorage.getItem("accessToken")}` } });
    load();
  }

  const total = costs.reduce((s, c) => s + c.amount, 0);
  const byCategory = CATEGORIES.map((cat) => ({ cat, total: costs.filter((c) => c.category === cat).reduce((s,c) => s+c.amount, 0) })).filter((c) => c.total > 0);

  return (
    <AdminLayout>
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Operating Costs</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track rent, utilities, wages and expenses</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
          + Add Cost
        </button>
      </div>

      <div className="p-6">
        {/* Date filters */}
        <div className="flex gap-3 mb-6 items-end flex-wrap">
          <div><label className={lCls}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
          <div><label className={lCls}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
        </div>

        {/* Summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-xl bg-[#0f172a] p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Costs</p>
            <p className="text-2xl font-bold text-white">₱{(total/100).toLocaleString("en-PH",{minimumFractionDigits:2})}</p>
          </div>
          {byCategory.map((c) => (
            <div key={c.cat} className="rounded-xl bg-white border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{ICONS[c.cat]} {c.cat}</p>
              <p className="text-xl font-bold text-slate-900">₱{(c.total/100).toLocaleString("en-PH",{minimumFractionDigits:2})}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>{["Name","Category","Frequency","Date","Amount",""].map((h,i) => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i===4?"text-right":"text-left"}`}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {costs.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">No costs recorded for this period</td></tr>}
              {costs.map((cost) => (
                <tr key={cost.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-900">{cost.name}</td>
                  <td className="px-4 py-3 text-slate-500">{ICONS[cost.category]} {cost.category}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{cost.frequency.toLowerCase().replace("_"," ")}</td>
                  <td className="px-4 py-3 text-slate-500">{format(new Date(cost.date),"MMM d, yyyy")}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">₱{(cost.amount/100).toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => handleDelete(cost.id)} className="text-xs text-slate-400 hover:text-red-500 transition">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 mx-4">
            <h3 className="font-bold text-slate-900 mb-5">Add Operating Cost</h3>
            <div className="space-y-3">
              <div><label className={lCls}>Description</label><input type="text" value={form.name} onChange={(e) => setForm((p) => ({...p,name:e.target.value}))} placeholder="e.g. Monthly Rent" className={iCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lCls}>Category</label><select value={form.category} onChange={(e) => setForm((p) => ({...p,category:e.target.value}))} className={iCls}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div><label className={lCls}>Frequency</label><select value={form.frequency} onChange={(e) => setForm((p) => ({...p,frequency:e.target.value}))} className={iCls}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lCls}>Amount (₱)</label><input type="number" value={form.amount} onChange={(e) => setForm((p) => ({...p,amount:e.target.value}))} placeholder="0.00" className={iCls} /></div>
                <div><label className={lCls}>Date</label><input type="date" value={form.date} onChange={(e) => setForm((p) => ({...p,date:e.target.value}))} className={iCls} /></div>
              </div>
              <div><label className={lCls}>Notes <span className="normal-case font-normal text-slate-400">(optional)</span></label><input type="text" value={form.notes} onChange={(e) => setForm((p) => ({...p,notes:e.target.value}))} className={iCls} /></div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleAdd} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Add</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
