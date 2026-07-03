"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/store/auth";
import type { TillSession } from "@blessed-ave/types";
import toast from "react-hot-toast";

const php = (c: number) => `₱${(c / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export default function TillPage() {
  const { user } = useAuth();
  const isManager = user?.role === "OWNER" || user?.role === "MANAGER";

  const [current, setCurrent] = useState<TillSession | null | undefined>(undefined);
  const [history, setHistory] = useState<TillSession[]>([]);
  const [openingFloat, setOpeningFloat] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCurrent() {
    const res = await adminApi.till.current();
    setCurrent(res.data);
  }
  async function loadHistory() {
    if (!isManager) return;
    try {
      const res = await adminApi.till.history();
      setHistory(res.data);
    } catch {
      // non-manager or no sessions yet
    }
  }

  useEffect(() => { loadCurrent(); loadHistory(); }, []);
  useEffect(() => {
    if (!current) return;
    const t = setInterval(loadCurrent, 15000);
    return () => clearInterval(t);
  }, [current?.id]);

  async function openTill() {
    const cents = Math.round(parseFloat(openingFloat || "0") * 100);
    if (isNaN(cents) || cents < 0) { toast.error("Enter a valid opening float"); return; }
    setBusy(true);
    try {
      await adminApi.till.open(cents);
      setOpeningFloat("");
      await loadCurrent();
      toast.success("Till opened");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to open till");
    } finally { setBusy(false); }
  }

  async function closeTill() {
    const cents = Math.round(parseFloat(actualCash || "0") * 100);
    if (isNaN(cents) || cents < 0) { toast.error("Enter the counted cash amount"); return; }
    setBusy(true);
    try {
      const res = await adminApi.till.close(cents, closeNotes || undefined);
      const variance = res.data.variance ?? 0;
      if (variance === 0) toast.success("Till closed — drawer balanced ✓");
      else toast(`Till closed — ${variance > 0 ? "over" : "short"} by ${php(Math.abs(variance))}`, { icon: variance > 0 ? "📈" : "⚠️" });
      setActualCash(""); setCloseNotes("");
      await Promise.all([loadCurrent(), loadHistory()]);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to close till");
    } finally { setBusy(false); }
  }

  const iCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <AdminLayout>
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="text-xl font-bold text-slate-900">Till</h1>
        <p className="text-xs text-slate-400 mt-0.5">Cash drawer open / close / reconciliation</p>
      </div>

      <div className="p-6 max-w-lg space-y-6">
        {current === undefined && <p className="text-sm text-slate-400">Loading…</p>}

        {current === null && (
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Open Till</h2>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Opening Float (₱)</label>
            <input type="number" min="0" step="0.01" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="0.00" className={iCls} />
            <button onClick={openTill} disabled={busy}
              className="mt-4 w-full rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50">
              {busy ? "Opening…" : "Open Till"}
            </button>
          </div>
        )}

        {current && (
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">Till Open</h2>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Open since {new Date(current.openedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="space-y-1.5 text-sm mb-5">
              <div className="flex justify-between"><span className="text-slate-500">Opened by</span><span className="text-slate-800 font-medium">{current.openedBy?.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Opening float</span><span className="text-slate-800">{php(current.openingFloat)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cash sales</span><span className="text-green-600">+{php(current.cashIn ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cash refunds</span><span className="text-red-500">−{php(current.cashOut ?? 0)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5 font-bold"><span className="text-slate-700">Expected in drawer</span><span className="text-slate-900">{php(current.expectedCash ?? 0)}</span></div>
            </div>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Counted Cash (₱)</label>
            <input type="number" min="0" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)}
              placeholder="0.00" className={iCls} />
            <textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            <button onClick={closeTill} disabled={busy}
              className="mt-3 w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50">
              {busy ? "Closing…" : "Close Till & Count Cash"}
            </button>
          </div>
        )}

        {isManager && history.length > 0 && (
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Sessions</h3>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider">
                <th className="pb-2 text-left font-semibold">Closed</th>
                <th className="pb-2 text-left font-semibold">By</th>
                <th className="pb-2 text-right font-semibold">Expected</th>
                <th className="pb-2 text-right font-semibold">Counted</th>
                <th className="pb-2 text-right font-semibold">Variance</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 text-slate-700">{s.closedAt ? new Date(s.closedAt).toLocaleString() : "—"}</td>
                    <td className="py-2 text-slate-600">{s.closedBy?.name}</td>
                    <td className="py-2 text-right text-slate-600">{php(s.expectedCash ?? 0)}</td>
                    <td className="py-2 text-right text-slate-600">{php(s.actualCash ?? 0)}</td>
                    <td className={`py-2 text-right font-semibold ${!s.variance ? "text-slate-400" : s.variance > 0 ? "text-green-600" : "text-red-600"}`}>
                      {s.variance ? `${s.variance > 0 ? "+" : ""}${php(s.variance)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
