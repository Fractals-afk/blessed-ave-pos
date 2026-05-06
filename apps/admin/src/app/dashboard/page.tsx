"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";

interface Summary {
  todayOrders:   number;
  weekRevenue:   number;
  pendingOrders: number;
  lowStockItems: number;
}

const QUICK_LINKS = [
  { href: "/kitchen", label: "Kitchen Display", desc: "Live order queue",       emoji: "👨‍🍳" },
  { href: "/pos",     label: "Open POS",        desc: "New walk-in order",      emoji: "🖥️"  },
  { href: "/reports", label: "Sales Report",    desc: "Revenue & analytics",    emoji: "📈"  },
  { href: "/pnl",     label: "P&L Statement",   desc: "Profit & loss",          emoji: "💹"  },
];

function PageHeader() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="border-b border-slate-200 bg-white px-8 py-5">
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{date}</p>
      <h1 className="text-xl font-bold text-slate-900">{greeting} 👋</h1>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    adminApi.reports.summary().then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  const stats = summary
    ? [
        {
          label: "Orders Today",
          value: summary.todayOrders,
          change: null,
          accent: "text-slate-900",
          bg: "bg-white",
          icon: "📋",
        },
        {
          label: "Revenue This Week",
          value: `₱${(summary.weekRevenue / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
          change: null,
          accent: "text-slate-900",
          bg: "bg-white",
          icon: "💰",
        },
        {
          label: "Pending Orders",
          value: summary.pendingOrders,
          change: summary.pendingOrders > 0 ? "Needs attention" : "All clear",
          accent: summary.pendingOrders > 0 ? "text-amber-600" : "text-slate-900",
          bg: summary.pendingOrders > 0 ? "bg-amber-50 border-amber-200" : "bg-white",
          icon: "⏳",
        },
        {
          label: "Low Stock Alerts",
          value: summary.lowStockItems,
          change: summary.lowStockItems > 0 ? "Reorder needed" : "Stock OK",
          accent: summary.lowStockItems > 0 ? "text-red-600" : "text-slate-900",
          bg: summary.lowStockItems > 0 ? "bg-red-50 border-red-200" : "bg-white",
          icon: "⚠️",
        },
      ]
    : [];

  return (
    <AdminLayout>
      <PageHeader />

      <div className="p-8">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {summary === null
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
              ))
            : stats.map((s) => (
                <div key={s.label} className={`rounded-xl border border-slate-200 p-5 ${s.bg}`}>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                    <span className="text-lg">{s.icon}</span>
                  </div>
                  <p className={`text-3xl font-bold ${s.accent}`}>{s.value}</p>
                  {s.change && (
                    <p className={`text-xs mt-1.5 ${s.accent} opacity-70`}>{s.change}</p>
                  )}
                </div>
              ))}
        </div>

        {/* Quick links */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Quick Access
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href}
                className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition group"
              >
                <span className="text-2xl">{link.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{link.label}</p>
                  <p className="text-xs text-slate-400">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent Orders</h3>
            <p className="text-sm text-slate-400">
              Go to{" "}
              <Link href="/orders" className="text-green-600 hover:underline font-medium">
                Orders
              </Link>{" "}
              to see the live order feed.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Inventory</h3>
            <p className="text-sm text-slate-400">
              Go to{" "}
              <Link href="/inventory" className="text-green-600 hover:underline font-medium">
                Inventory
              </Link>{" "}
              to manage stock and receive orders.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
