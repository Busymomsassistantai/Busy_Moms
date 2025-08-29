import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Phone, CalendarCheck2, Clock, User, MapPin, ShieldCheck, NotebookTabs, Info, Loader2, Plus, Trash2, CalendarPlus } from "lucide-react";

// ... (system prompt, types, and component setup remain unchanged)

export default function OutboundReservationsWidget() {
  // added calendar UI state
  const [addingCalendar, setAddingCalendar] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<string>("");
  // ... (state definitions remain unchanged)

  async function runAgent() {
    // ... (same as before)
  }

  async function addToCalendar() {
    if (!resultJson?.booked?.start || !resultJson?.booked?.end) return;
    setAddingCalendar(true);
    setCalendarMsg("");
    try {
      const title = userTask?.type ? `${userTask.type} appointment for ${userTask.user_name}` : "Appointment";
      const resp = await fetch("/api/agent/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: resultJson.booked.start,
          end: resultJson.booked.end,
          title,
          location: resultJson.booked.location || resultJson?.business?.name || "",
          attendees: [userTask.user_name]
        })
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Calendar add failed");
      setCalendarMsg("Added to calendar ✓");
    } catch (e: any) {
      setCalendarMsg(e.message || "Unknown error");
    } finally {
      setAddingCalendar(false);
    }
  }
  }

  // ... (helper functions unchanged)

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          <div className="rounded-2xl shadow-sm border p-4 sm:p-6 bg-white">
            {/* ... (form fields unchanged) */}
            <div className="mt-6 flex gap-3">
              <button disabled={!canSubmit} onClick={runAgent} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 border bg-black text-white disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Phone className="w-4 h-4"/>}
                {loading ? "Calling…" : "Call & Book"}
              </button>
              {resultJson?.status === "booked" && !addingCalendar && (
                <button
                onClick={addToCalendar}
                disabled={addingCalendar}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 border bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {addingCalendar ? <Loader2 className="w-4 h-4 animate-spin"/> : <CalendarPlus className="w-4 h-4"/>}
                {addingCalendar ? "Adding…" : "Add to Calendar"}
              </button>
              {calendarMsg && <span className="text-xs text-gray-700">{calendarMsg}</span>}
              )}
              <div className="text-xs text-gray-500 flex items-center">Respects business hours • Privacy-safe by design</div>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {/* ... (result summary unchanged) */}
        </div>
      </motion.div>
    </div>
  );
}

// ... (helper components unchanged)
