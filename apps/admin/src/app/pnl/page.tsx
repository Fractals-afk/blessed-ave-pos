"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { format, subDays, startOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface PnLData {
  period: { from: string; to: string };
  totalRevenue: number; totalOrders: number; totalCOGS: number;
  grossProfit: number; grossMargin: number; totalOpCosts: number;
  opCostsByCategory: Record<string, number>; netProfit: number; netMargin: number;
  itemBreakdown: { name: string; quantity: number; revenue: number; cogs: number; margin: number }[];
  daily: { date: string; revenue: number; cogs: number; opCosts: number; netProfit: number }[];
}

const php = (c: number) => `₱${(c/100).toLocaleString("en-PH",{minimumFractionDigits:2})}`;
const iCls = "rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

function Pill({ pct }: { pct: number }) {
  const cls = pct >= 60 ? "bg-green-100 text-green-700" : pct >= 30 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${cls}`}>{pct}%</span>;
}

export default function PnLPage() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [data,    setData]    = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pnl?from=${from}&to=${to}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } });
      const json = await res.json(); setData(json.data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const chartData = (data?.daily ?? []).map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    Revenue: d.revenue/100, COGS: d.cogs/100, "Net Profit": d.netProfit/100,
  }));

  return (
    <AdminLayout>
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="text-xl font-bold text-slate-900">Profit & Loss</h1>
        <p className="text-xs text-slate-400 mt-0.5">Revenue, COGS, and net profit</p>
      </div>

      <div className="p-6">
        {/* Controls */}
        <div className="flex gap-3 mb-6 flex-wrap items-end">
          <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={iCls} /></div>
          <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={iCls} /></div>
          <button onClick={load} className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
            {loading ? "Loading…" : "Apply"}
          </button>
          <div className="flex gap-2">
            {[
              { label: "This month", from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") },
              { label: "Last 30d",   from: format(subDays(new Date(), 30), "yyyy-MM-dd"),  to: format(new Date(), "yyyy-MM-dd") },
              { label: "Last 7d",    from: format(subDays(new Date(), 7),  "yyyy-MM-dd"),  to: format(new Date(), "yyyy-MM-dd") },
            ].map((r) => (
              <button key={r.label} onClick={() => { setFrom(r.from); setTo(r.to); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <>
            {/* P&L Statement */}
            <div className="rounded-xl bg-white border border-slate-200 p-6 mb-5">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5">
                P&L Statement · {format(new Date(from), "MMM d")} – {format(new Date(to), "MMM d, yyyy")}
              </h2>
              <div className="divide-y divide-slate-100">
                <div className="flex justify-between py-3">
                  <span className="text-sm font-semibold text-slate-700">Gross Revenue</span>
                  <span className="text-sm font-bold text-slate-900">{php(data.totalRevenue)}</span>
                </div>
                <div className="flex justify-between py-2.5 pl-4">
                  <span className="text-xs text-slate-400">Total Orders</span>
                  <span className="text-xs text-slate-600">{data.totalOrders}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm font-semibold text-slate-700">Cost of Goods Sold</span>
                  <span className="text-sm font-bold text-red-500">({php(data.totalCOGS)})</span>
                </div>
                <div className="flex justify-between py-3 bg-green-50 px-4 rounded-lg my-1">
                  <span className="text-sm font-bold text-slate-900">Gross Profit</span>
                  <div className="flex items-center gap-3">
                    <Pill pct={data.grossMargin} />
                    <span className={`text-sm font-bold ${data.grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>{php(data.grossProfit)}</span>
                  </div>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm font-semibold text-slate-700">Operating Expenses</span>
                  <span className="text-sm font-bold text-red-500">({php(data.totalOpCosts)})</span>
                </div>
                {Object.entries(data.opCostsByCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between py-2 pl-4">
                    <span className="text-xs text-slate-400 capitalize">{cat.toLowerCase()}</span>
                    <span className="text-xs text-red-400">({php(amt as number)})</span>
                  </div>
                ))}
                <div className={`flex justify-between py-4 px-4 rounded-lg mt-1 ${data.netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                  <span className="text-base font-bold text-slate-900">Net Profit</span>
                  <div className="flex items-center gap-3">
                    <Pill pct={data.netMargin} />
                    <span className={`text-base font-bold ${data.netProfit >= 0 ? "text-green-700" : "text-red-600"}`}>{php(data.netProfit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 p-5 mb-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Breakdown</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }} formatter={(v: number) => `₱${v.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="Revenue"    fill="#22c55e" radius={[3,3,0,0]} />
                    <Bar dataKey="COGS"       fill="#f59e0b" radius={[3,3,0,0]} />
                    <Bar dataKey="Net Profit" fill="#0f172a" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Item margins */}
            {data.itemBreakdown.length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Item Margins</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    {["Item","Qty","Revenue","COGS","Profit","Margin"].map((h,i) => (
                      <th key={h} className={`pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i>0?"text-right":"text-left"}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.itemBreakdown.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
                        <td className="py-2.5 text-right text-slate-500">{item.quantity}</td>
                        <td className="py-2.5 text-right text-slate-600">{php(item.revenue)}</td>
                        <td className="py-2.5 text-right text-red-400">{php(item.cogs)}</td>
                        <td className="py-2.5 text-right font-semibold text-green-600">{php(item.revenue-item.cogs)}</td>
                        <td className="py-2.5 text-right"><Pill pct={item.margin} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.itemBreakdown.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-semibold text-amber-800">No recipe costs found</p>
                <p className="text-amber-600 mt-1">Map ingredients to menu items in Inventory to see item-level margins.</p>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
