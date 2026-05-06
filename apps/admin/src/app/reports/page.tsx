"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["#0f172a", "#22c55e", "#3b82f6", "#f59e0b"];

export default function ReportsPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [report,  setReport]  = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { const res = await adminApi.reports.sales(from, to); setReport(res.data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const paymentData = report
    ? Object.entries(report.byPaymentMethod as Record<string, number>)
        .map(([name, value]) => ({ name, value: (value as number) / 100 })).filter((d) => d.value > 0)
    : [];

  const dailyData = (report?.daily ?? []).map((d: any) => ({
    date: format(new Date(d.date), "MMM d"), revenue: d.revenue / 100, orders: d.orders,
  }));

  const iCls = "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <AdminLayout>
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="text-xl font-bold text-slate-900">Sales Reports</h1>
        <p className="text-xs text-slate-400 mt-0.5">Revenue and order analytics</p>
      </div>

      <div className="p-6">
        {/* Controls */}
        <div className="flex items-end gap-3 mb-6 flex-wrap">
          <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={iCls} /></div>
          <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={iCls} /></div>
          <button onClick={load} className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
            {loading ? "Loading…" : "Apply"}
          </button>
          {report && (
            <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/reports/sales?from=${from}&to=${to}&format=csv`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              Export CSV ↓
            </a>
          )}
        </div>

        {report && (
          <>
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {[
                { label: "Total Orders",  value: report.totalOrders, accent: "text-slate-900" },
                { label: "Revenue",       value: `₱${(report.totalRevenue / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, accent: "text-green-600" },
                { label: "Online Orders", value: report.bySource?.ONLINE   ?? 0, accent: "text-slate-900" },
                { label: "Table Orders",  value: report.bySource?.QR_TABLE ?? 0, accent: "text-slate-900" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-white border border-slate-200 p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.accent}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2 mb-6">
              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Revenue (₱)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }} formatter={(v: number) => [`₱${v.toFixed(2)}`, "Revenue"]} />
                    <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Payment Methods</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }} formatter={(v: number) => [`₱${v.toFixed(2)}`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top items */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Selling Items</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {(report.topItems ?? []).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
                      <td className="py-2.5 text-right text-slate-500">{item.quantity}</td>
                      <td className="py-2.5 text-right font-bold text-green-600">₱{(item.revenue / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
