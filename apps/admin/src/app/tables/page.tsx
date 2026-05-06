"use client";

import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { CafeTable } from "@blessed-ave/types";
import QRCode from "qrcode";
import toast from "react-hot-toast";

export default function TablesPage() {
  const [tables,  setTables]  = useState<CafeTable[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [qrModal, setQrModal] = useState<CafeTable | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL ?? "http://localhost:3000";

  async function load() { const res = await adminApi.tables.list(); setTables(res.data); }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (qrModal && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, `${CLIENT_URL}/table/${qrModal.qrToken}`, { width: 240, margin: 2 });
    }
  }, [qrModal]);

  async function handleAdd() {
    try { await adminApi.tables.create(newName); toast.success("Table added"); setShowAdd(false); setNewName(""); load(); }
    catch (err: any) { toast.error(err.message); }
  }
  async function handleRegenerate(table: CafeTable) {
    if (!confirm(`Regenerate QR for ${table.name}? Old QR stops working.`)) return;
    try { const res = await adminApi.tables.regenerateQr(table.id); setQrModal(res as any); load(); }
    catch (err: any) { toast.error(err.message); }
  }
  function downloadQR(table: CafeTable) {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.download = `${table.name.replace(/\s+/g,"-")}-QR.png`;
    a.href = canvasRef.current.toDataURL(); a.click();
  }

  return (
    <AdminLayout>
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tables & QR Codes</h1>
          <p className="text-xs text-slate-400 mt-0.5">Generate QR codes for table ordering</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
          + Add Table
        </button>
      </div>

      <div className="p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <div key={table.id} className="rounded-xl bg-white border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-slate-900">{table.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{table.qrToken.slice(0,8)}…</p>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${table.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                  {table.active ? "Active" : "Off"}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setQrModal(table)} className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                  View QR
                </button>
                <button onClick={() => handleRegenerate(table)} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition">
                  Regenerate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl border border-slate-200 mx-4">
            <h3 className="font-bold text-slate-900 mb-4">Add Table</h3>
            <input type="text" placeholder="e.g. Table 9, Window Seat" value={newName} onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleAdd} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setQrModal(null)}>
          <div className="rounded-2xl bg-white p-8 shadow-xl border border-slate-200 text-center mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">QR Code</p>
            <h3 className="text-xl font-bold text-slate-900 mb-1">{qrModal.name}</h3>
            <p className="text-xs text-slate-400 mb-5 font-mono">{CLIENT_URL}/table/{qrModal.qrToken}</p>
            <canvas ref={canvasRef} className="rounded-xl mx-auto border border-slate-100" />
            <div className="mt-5 flex gap-3 justify-center">
              <button onClick={() => downloadQR(qrModal)} className="rounded-lg bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
                Download PNG
              </button>
              <button onClick={() => setQrModal(null)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
