import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Phone, CalendarCheck2, Clock, User, MapPin, ShieldCheck, NotebookTabs, Info, Loader2, Plus, Trash2 } from "lucide-react";

/**
 * OutboundReservationsWidget
 * ------------------------------------------------------------
 * A front-end React component that gathers all pre-call details,
 * sends them to your backend endpoint that wraps the OpenAI API
 * (Responses + tool calling or Realtime), and renders the
 * machine-readable JSON + a human summary for the user.
 *
 * What you still need on the backend:
 *  - POST /api/agent/reservations
 *    Body: { userTask, systemPromptOverride? }
 *    Returns: { ok: boolean, text: string, json?: any, error?: string }
 *
 * You must NOT call OpenAI directly from the browser with your API key.
 * Proxy via your server.
 *
 * Tailwind required. shadcn/ui optional; this uses plain elements.
 */

// --- Default System Prompt --------------------------------------------------
const DEFAULT_SYSTEM_PROMPT = `
You are an outbound appointments & reservations agent calling on behalf of {{user_name}}.

GOALS (priority):
1) Schedule/reschedule/cancel the requested appointment/reservation.
2) Confirm all details: date/time/timezone, location/provider, price/fees/deposit, requirements/prep, cancellation/no-show, confirmation number.
3) Return a structured JSON record + a brief human summary.

PRE-CALL CHECKLIST (must confirm before dialing):
- Target: business/contact name + phone (or ask to search).
- Type: medical | dining | salon | repair | business | other.
- Action: schedule | reschedule | cancel.
- Preferred windows: 1–3 options (start/end), timezone, duration if relevant.
- Constraints: provider preference, budget, insurance/payment, accessibility, language.
- Special instructions to communicate.
- Authorization: exactly which PHI/PII/payment details may be shared.
- Fallbacks: acceptable alternates if first choices aren’t available.

ON-CALL FLOW:
1) Intro: “Hi, this is {{agent_name}}, calling for {{user_name}}.”
2) Purpose: “[schedule/reschedule/cancel] a {{appointment_type}}.”
3) Offer options: present user windows or ask for nearest availability.
4) Clarify: date/time/duration, location/provider, price/fees/deposit, prep, parking/check-in.
5) Policies: cancellation/no-show windows & fees.
6) Confirmation: ask for confirmation number + email/SMS confirmation.
7) Close: read back final details verbatim and thank them.

LIMITATIONS & GUARDRAILS:
- Only call during local business hours. If unknown, look up hours first.
- Do not share personal/medical/payment info unless explicitly authorized this session.
- Reconfirm any sensitive details before disclosing.
- If info is missing, pause and collect from user, then continue.
- If booking is impossible, capture first available, offer waitlist or alternates.

RETURN FORMAT (always output this JSON + 6–8 bullet human summary):
{
  "status": "booked | rescheduled | canceled | info_only | failed",
  "business": {"name":"","phone":"","address":"","website":"","timezone":""},
  "contact": {"name":"","role":""},
  "request": {
    "type":"medical|dining|salon|repair|business|other",
    "action":"schedule|reschedule|cancel",
    "preferences":{
      "time_windows":[{"start":"","end":""}],
      "duration_minutes":null,
      "constraints":[]
    },
    "special_instructions":"",
    "authorized_to_share":[]
  },
  "offer_options":[{"start":"","end":"","provider":"","price":null}],
  "booked":{
    "start":"","end":"","provider":"","location":"",
    "room_or_table":"","price_or_copay":null,
    "requirements":[],"prep_instructions":"",
    "cancellation_policy":"","confirmation_number":"",
    "confirmation_channel":"email|sms|phone",
    "confirmation_delivered":false
  },
  "followups":[],
  "notes":"",
  "next_actions":[]
}
Then provide a concise bullet summary for the user and ask: “Add to calendar?”
`;

// --- Types ------------------------------------------------------------------

type TimeWindow = { start: string; end: string };

type UserTask = {
  user_name: string;
  agent_name: string;
  business?: { name?: string; phone?: string; address?: string };
  type: "medical" | "dining" | "salon" | "repair" | "business" | "other";
  action: "schedule" | "reschedule" | "cancel";
  time_windows: TimeWindow[];
  timezone?: string;
  duration_minutes?: number | null;
  constraints?: string[];
  special_instructions?: string;
  authorized_to_share?: string[]; // e.g. ["full_name","email","phone","insurance"]
  fallbacks?: string[]; // e.g. ["same-day later", "next day", "alternate location"]
};

// --- Component --------------------------------------------------------------
export default function OutboundReservationsWidget() {
  const [userTask, setUserTask] = useState<UserTask>({
    user_name: "Daniel",
    agent_name: "Busy Moms Assistant",
    business: { name: "", phone: "", address: "" },
    type: "dining",
    action: "schedule",
    time_windows: [
      { start: "2025-09-03T18:00", end: "2025-09-03T20:00" }
    ],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    duration_minutes: null,
    constraints: [],
    special_instructions: "",
    authorized_to_share: ["full_name", "phone"],
    fallbacks: ["same-day later", "next day"]
  });

  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState<string>("");
  const [resultJson, setResultJson] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(() => {
    const hasTarget = Boolean(userTask.business?.name || userTask.business?.phone);
    const hasWindow = userTask.time_windows.length > 0 && userTask.time_windows.every(w => w.start && w.end);
    return hasTarget && hasWindow && !loading;
  }, [userTask, loading]);

  async function runAgent() {
    setLoading(true);
    setError("");
    setResultText("");
    setResultJson(null);

    try {
      const resp = await fetch("/api/agent/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userTask, systemPromptOverride: systemPrompt })
      });

      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Agent call failed");

      setResultText(data.text || "");
      setResultJson(data.json || null);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function updateBusiness<K extends keyof NonNullable<UserTask["business"]>>(key: K, value: string) {
    setUserTask(prev => ({
      ...prev,
      business: { ...(prev.business || {}), [key]: value }
    }));
  }

  function updateWindow(idx: number, key: keyof TimeWindow, value: string) {
    setUserTask(prev => ({
      ...prev,
      time_windows: prev.time_windows.map((w, i) => i === idx ? { ...w, [key]: value } : w)
    }));
  }

  function addWindow() {
    setUserTask(prev => ({ ...prev, time_windows: [...prev.time_windows, { start: "", end: "" }] }));
  }

  function removeWindow(idx: number) {
    setUserTask(prev => ({ ...prev, time_windows: prev.time_windows.filter((_, i) => i !== idx) }));
  }

  function addConstraint() {
    const value = prompt("Add a constraint (e.g., budget<=150, ground_floor_access)")?.trim();
    if (!value) return;
    setUserTask(prev => ({ ...prev, constraints: [...(prev.constraints || []), value] }));
  }

  function removeConstraint(value: string) {
    setUserTask(prev => ({ ...prev, constraints: (prev.constraints || []).filter(c => c !== value) }));
  }

  function addAuthorized() {
    const value = prompt("Authorize sharing (e.g., full_name, phone, email, insurance)")?.trim();
    if (!value) return;
    setUserTask(prev => ({ ...prev, authorized_to_share: [ ...(prev.authorized_to_share || []), value ] }));
  }

  function removeAuthorized(value: string) {
    setUserTask(prev => ({ ...prev, authorized_to_share: (prev.authorized_to_share || []).filter(c => c !== value) }));
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          <div className="rounded-2xl shadow-sm border p-4 sm:p-6 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Outbound Call Setup</h2>
            </div>

            {/* User & Agent */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LabeledInput icon={<User className="w-4 h-4"/>} label="User Name" value={userTask.user_name} onChange={(v) => setUserTask(p=>({...p,user_name:v}))} />
              <LabeledInput icon={<User className="w-4 h-4"/>} label="Agent Name" value={userTask.agent_name} onChange={(v) => setUserTask(p=>({...p,agent_name:v}))} />
            </div>

            {/* Business */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <LabeledInput icon={<NotebookTabs className="w-4 h-4"/>} label="Business/Contact Name" value={userTask.business?.name || ""} onChange={(v)=>updateBusiness("name", v)} />
              <LabeledInput icon={<Phone className="w-4 h-4"/>} label="Phone" value={userTask.business?.phone || ""} onChange={(v)=>updateBusiness("phone", v)} />
              <LabeledInput icon={<MapPin className="w-4 h-4"/>} label="Address (optional)" value={userTask.business?.address || ""} onChange={(v)=>updateBusiness("address", v)} />
            </div>

            {/* Type & Action */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <SelectField label="Type" value={userTask.type} onChange={(v)=>setUserTask(p=>({...p,type:v as UserTask["type"]}))} options={["medical","dining","salon","repair","business","other"]} />
              <SelectField label="Action" value={userTask.action} onChange={(v)=>setUserTask(p=>({...p,action:v as UserTask["action"]}))} options={["schedule","reschedule","cancel"]} />
              <LabeledInput icon={<Clock className="w-4 h-4"/>} label="Duration (mins)" value={userTask.duration_minutes?.toString() || ""} onChange={(v)=>setUserTask(p=>({...p,duration_minutes: v? Number(v): null}))} type="number" />
            </div>

            {/* Time Windows */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2"><CalendarCheck2 className="w-4 h-4"/>Preferred Time Windows</label>
                <button onClick={addWindow} className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-xl border hover:bg-gray-50"><Plus className="w-4 h-4"/>Add</button>
              </div>
              <div className="space-y-2 mt-2">
                {userTask.time_windows.map((w, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <input type="datetime-local" value={w.start} onChange={(e)=>updateWindow(idx, "start", e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-5">
                      <input type="datetime-local" value={w.end} onChange={(e)=>updateWindow(idx, "end", e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <button onClick={()=>removeWindow(idx)} className="text-red-600 hover:text-red-700 p-2" aria-label="Remove window"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Constraints & Authorization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>Authorized to Share</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(userTask.authorized_to_share||[]).map(tag => (
                    <Tag key={tag} label={tag} onRemove={()=>removeAuthorized(tag)} />
                  ))}
                  <button onClick={addAuthorized} className="text-sm px-2 py-1 rounded-xl border hover:bg-gray-50 inline-flex items-center gap-1"><Plus className="w-4 h-4"/>Add</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Constraints</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(userTask.constraints||[]).map(tag => (
                    <Tag key={tag} label={tag} onRemove={()=>removeConstraint(tag)} />
                  ))}
                  <button onClick={addConstraint} className="text-sm px-2 py-1 rounded-xl border hover:bg-gray-50 inline-flex items-center gap-1"><Plus className="w-4 h-4"/>Add</button>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-4">
              <label className="text-sm font-medium flex items-center gap-2"><Info className="w-4 h-4"/>Special Instructions</label>
              <textarea value={userTask.special_instructions || ""} onChange={(e)=>setUserTask(p=>({...p, special_instructions:e.target.value}))} rows={3} className="w-full rounded-xl border px-3 py-2 text-sm mt-1" placeholder="e.g., quiet table, ground-floor access, bring laptop" />
            </div>

            {/* System Prompt (advanced) */}
            <details className="mt-4">
              <summary className="text-sm text-gray-600 cursor-pointer">Advanced: Override System Prompt</summary>
              <textarea value={systemPrompt} onChange={(e)=>setSystemPrompt(e.target.value)} rows={10} className="w-full rounded-xl border px-3 py-2 text-sm mt-2 font-mono" />
            </details>

            <div className="mt-6 flex gap-3">
              <button disabled={!canSubmit} onClick={runAgent} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 border bg-black text-white disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Phone className="w-4 h-4"/>}
                {loading ? "Calling…" : "Call & Book"}
              </button>
              <div className="text-xs text-gray-500 flex items-center">Respects business hours • Privacy-safe by design</div>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <div className="rounded-2xl shadow-sm border p-4 sm:p-6 bg-white">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><NotebookTabs className="w-5 h-5"/> Result Summary</h2>
            {error && (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-sm mb-3">{error}</div>
            )}
            {!resultText && !resultJson && !loading && (
              <p className="text-sm text-gray-600">No call yet. Fill the form and click <b>Call & Book</b>.</p>
            )}
            {resultText && (
              <div className="prose max-w-none text-sm">
                <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 border rounded-xl p-3">{resultText}</pre>
              </div>
            )}
          </div>

          <div className="rounded-2xl shadow-sm border p-4 sm:p-6 bg-white">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><CalendarCheck2 className="w-5 h-5"/> Machine-Readable JSON</h2>
            {resultJson ? (
              <pre className="text-xs bg-gray-50 border rounded-xl p-3 overflow-auto max-h-[420px]">{JSON.stringify(resultJson, null, 2)}</pre>
            ) : (
              <p className="text-sm text-gray-600">Once the agent completes, the JSON record appears here (status, booking, confirmation, follow-ups, etc.).</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Small UI helpers -------------------------------------------------------
function LabeledInput({ label, value, onChange, icon, type="text" }:{ label:string; value:string; onChange:(v:string)=>void; icon?:React.ReactNode; type?:string }){
  return (
    <label className="text-sm">
      <span className="text-sm font-medium flex items-center gap-2 mb-1">{icon}{label}</span>
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm"/>
    </label>
  );
}

function SelectField({ label, value, onChange, options }:{ label:string; value:string; onChange:(v:string)=>void; options:string[] }){
  return (
    <label className="text-sm">
      <span className="text-sm font-medium mb-1 block">{label}</span>
      <select value={value} onChange={(e)=>onChange(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm bg-white">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Tag({ label, onRemove }:{ label:string; onRemove:()=>void }){
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-xl border bg-gray-50">
      {label}
      <button onClick={onRemove} className="p-0.5" aria-label={`Remove ${label}`}>
        <Trash2 className="w-3 h-3"/>
      </button>
    </span>
  );
}
