"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Staff = { id: string; name: string };
type ClockEvent = { id: string; type: string; timestamp: string };
type ClockType = "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";

function lastStatus(events: ClockEvent[]): ClockType | null {
  if (events.length === 0) return null;
  return events[events.length - 1].type as ClockType;
}

function nextActions(status: ClockType | null): { type: ClockType; label: string; color: string }[] {
  if (status === null || status === "CLOCK_OUT") {
    return [{ type: "CLOCK_IN", label: "Clock In", color: "bg-emerald-600 hover:bg-emerald-500" }];
  }
  if (status === "CLOCK_IN" || status === "BREAK_END") {
    return [
      { type: "BREAK_START", label: "Take Break", color: "bg-amber-600 hover:bg-amber-500" },
      { type: "CLOCK_OUT", label: "Clock Out", color: "bg-red-700 hover:bg-red-600" },
    ];
  }
  if (status === "BREAK_START") {
    return [{ type: "BREAK_END", label: "End Break", color: "bg-emerald-600 hover:bg-emerald-500" }];
  }
  return [{ type: "CLOCK_IN", label: "Clock In", color: "bg-emerald-600 hover:bg-emerald-500" }];
}

export default function StaffClockPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.staffKiosk
      .list()
      .then((res) => setStaff(res.data))
      .catch(() => setError("Could not load staff list."));
  }, []);

  const status = useMemo(() => lastStatus(events), [events]);
  const actions = useMemo(() => nextActions(status), [status]);

  function selectStaff(person: Staff) {
    setSelected(person);
    setError(null);
    setConfirmation(null);
    setLoading(true);
    api.staffKiosk
      .today(person.id)
      .then((res) => setEvents(res.data as ClockEvent[]))
      .catch(() => setError("Could not load today's log."))
      .finally(() => setLoading(false));
  }

  function punch(type: ClockType) {
    if (!selected) return;
    setLoading(true);
    setError(null);
    api.staffKiosk
      .clock(selected.id, type)
      .then((res) => {
        setEvents((prev) => [...prev, res.data as ClockEvent]);
        const time = new Date(res.data.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        setConfirmation(`${type.replace("_", " ")} recorded at ${time}`);
        setTimeout(() => {
          setSelected(null);
          setEvents([]);
          setConfirmation(null);
        }, 2500);
      })
      .catch(() => setError("Could not record punch. Try again."))
      .finally(() => setLoading(false));
  }

  return (
    <main className="min-h-screen bg-[#0d0805] text-cream-200 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-10">
          <Link href="/store" className="text-cream-300/60 text-sm hover:text-gold-400">
            ← Back
          </Link>
          <p className="text-gold-400 text-xs font-semibold uppercase tracking-[0.4em]">
            Time Clock
          </p>
          <div className="w-10" />
        </div>

        {!selected && (
          <>
            <h1 className="font-display text-3xl font-bold text-cream-100 mb-8 text-center">
              Tap your name
            </h1>
            <div className="grid gap-4 sm:grid-cols-2">
              {staff.map((person) => (
                <button
                  key={person.id}
                  onClick={() => selectStaff(person)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] py-8 px-6 text-center text-2xl font-display font-bold text-white hover:border-gold-500/50 hover:bg-white/[0.06] active:scale-95 transition"
                >
                  {person.name}
                </button>
              ))}
            </div>
            {staff.length === 0 && (
              <p className="text-center text-cream-300/50 mt-8">No staff accounts found.</p>
            )}
          </>
        )}

        {selected && (
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-cream-100 mb-2">
              {selected.name}
            </h1>
            <p className="text-cream-300/50 mb-10">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>

            {confirmation ? (
              <p className="text-2xl font-display font-bold text-gold-400 py-16">{confirmation}</p>
            ) : (
              <div className="grid gap-5">
                {actions.map((a) => (
                  <button
                    key={a.type}
                    disabled={loading}
                    onClick={() => punch(a.type)}
                    className={`${a.color} disabled:opacity-50 rounded-2xl py-10 text-3xl font-display font-bold text-white active:scale-95 transition`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {!confirmation && (
              <button
                onClick={() => {
                  setSelected(null);
                  setEvents([]);
                }}
                className="mt-8 text-cream-300/50 text-sm hover:text-gold-400"
              >
                Not you? Go back
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-6 text-center text-red-400 text-sm">{error}</p>}
      </div>
    </main>
  );
}
