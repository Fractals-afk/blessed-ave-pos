"use client";

import { useEffect, useState } from "react";

const FALLBACK_ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";

function useAdminBase() {
  const [base, setBase] = useState(FALLBACK_ADMIN_URL);
  useEffect(() => {
    fetch("/dev-ports.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((ports) => {
        if (ports?.admin) setBase(`http://localhost:${ports.admin}`);
      })
      .catch(() => {});
  }, []);
  return base;
}

const OPTIONS = [
  { label: "POS", desc: "Take orders, ring up sales", path: "/pos", icon: "🛒" },
  { label: "Kitchen", desc: "Live order queue", path: "/kitchen", icon: "🍳" },
  { label: "Admin", desc: "Reports, menu, inventory", path: "/login", icon: "🔐" },
];

export default function StorePage() {
  const adminBase = useAdminBase();

  return (
    <main className="min-h-screen bg-[#0d0805] text-cream-200 flex flex-col items-center justify-center px-6 py-16">
      <div className="flex items-center gap-3 mb-14">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/50 bg-black/30">
          <span className="font-display text-xl font-black text-gold-400">B</span>
        </div>
        <span className="font-display font-bold text-white tracking-wide">Blessed Ave.</span>
      </div>

      <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em] mb-4">
        Staff Access
      </p>
      <h1 className="font-display text-4xl md:text-5xl font-bold text-cream-100 mb-12 text-center">
        Where to?
      </h1>

      <div className="grid gap-5 sm:grid-cols-3 w-full max-w-3xl">
        {OPTIONS.map((opt) => (
          <a
            key={opt.label}
            href={`${adminBase}${opt.path}`}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center hover:border-gold-500/50 hover:bg-white/[0.06] transition"
          >
            <div className="text-4xl mb-4">{opt.icon}</div>
            <p className="font-display text-xl font-bold text-white group-hover:text-gold-400 transition">
              {opt.label}
            </p>
            <p className="mt-1 text-sm text-cream-300/50">{opt.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
