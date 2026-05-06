"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminApi } from "@/lib/api";
import type { User, Shift } from "@blessed-ave/types";
import toast from "react-hot-toast";
import { format, startOfWeek, addDays } from "date-fns";

const iCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition";
const lCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5";

export default function StaffPage() {
  const [staff,     setStaff]     = useState<User[]>([]);
  const [shifts,    setShifts]    = useState<Shift[]>([]);
  const [tab,       setTab]       = useState<"staff"|"schedule">("staff");
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState({ name:"", email:"", password:"", role:"STAFF" });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  async function loadStaff() { const res = await adminApi.staff.list(); setStaff(res.data); }
  async function loadShifts() {
    const from = format(weekStart,"yyyy-MM-dd"), to = format(addDays(weekStart,6),"yyyy-MM-dd");
    const res = await adminApi.staff.getShifts(from, to); setShifts(res.data);
  }
  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { if (tab === "schedule") loadShifts(); }, [tab, weekStart]);

  async function handleAddStaff() {
    try { await adminApi.staff.create(form); toast.success("Staff added"); setShowAdd(false); loadStaff(); }
    catch (err: any) { toast.error(err.message); }
  }
  async function toggleActive(user: User) {
    try { await adminApi.staff.update(user.id, { active: !user.active }); loadStaff(); }
    catch (err: any) { toast.error(err.message); }
  }

  const ROLE_COLOR: Record<string, string> = {
    OWNER: "bg-violet-100 text-violet-700", MANAGER: "bg-blue-100 text-blue-700", STAFF: "bg-slate-100 text-slate-600",
  };

  return (
    <AdminLayout>
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff</h1>
          <p className="text-xs text-slate-400 mt-0.5">{staff.length} team members</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">
          + Add Staff
        </button>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-1.5 mb-6">
          {(["staff","schedule"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t ? "bg-[#0f172a] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {t === "staff" ? "Team Members" : "Schedule"}
            </button>
          ))}
        </div>

        {tab === "staff" && (
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{["Member","Email","Role","Status",""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staff.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 flex-shrink-0">
                          {m.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${ROLE_COLOR[m.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {m.role.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${m.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                        {m.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleActive(m)} className="text-xs text-slate-400 hover:text-slate-700 transition">
                        {m.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "schedule" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setWeekStart((w) => addDays(w,-7))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition">← Prev</button>
              <span className="text-sm font-medium text-slate-700">{format(weekStart,"MMM d")} – {format(addDays(weekStart,6),"MMM d, yyyy")}</span>
              <button onClick={() => setWeekStart((w) => addDays(w,7))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition">Next →</button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayStr = format(day,"yyyy-MM-dd");
                const dayShifts = shifts.filter((s) => format(new Date(s.date),"yyyy-MM-dd") === dayStr);
                return (
                  <div key={dayStr} className="rounded-xl bg-white border border-slate-200 p-3 min-h-[110px]">
                    <p className="text-xs font-semibold text-slate-400 mb-2">{format(day,"EEE d")}</p>
                    {dayShifts.map((shift) => (
                      <div key={shift.id} className="mb-1.5 rounded-md bg-slate-100 px-2 py-1.5">
                        <p className="text-xs font-semibold text-slate-700">{(shift as any).user?.name ?? "—"}</p>
                        <p className="text-xs text-slate-500">{shift.startTime}–{shift.endTime}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 mx-4">
            <h3 className="font-bold text-slate-900 mb-5">Add Staff Member</h3>
            <div className="space-y-3">
              {[{label:"Full Name",key:"name",type:"text"},{label:"Email",key:"email",type:"email"},{label:"Password",key:"password",type:"password"}].map((f) => (
                <div key={f.key}><label className={lCls}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({...p,[f.key]:e.target.value}))} className={iCls} /></div>
              ))}
              <div><label className={lCls}>Role</label>
                <select value={form.role} onChange={(e) => setForm((p) => ({...p,role:e.target.value}))} className={iCls}>
                  <option value="STAFF">Staff</option><option value="MANAGER">Manager</option><option value="OWNER">Owner</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleAddStaff} className="flex-1 rounded-lg bg-[#0f172a] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Add</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
