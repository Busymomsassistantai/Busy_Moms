import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL

// Validate URL format: https://<project_ref>.supabase.co
const urlValid = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.test(url || '');
const expectedProjectRef = 'rtvwcyrksplhsgycyfzo';

if (!url || !anonKey) {
  throw new Error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    `Expected: https://${expectedProjectRef}.supabase.co`
  )
}

if (!urlValid) {
  throw new Error(
    `[supabase] VITE_SUPABASE_URL format invalid: "${url}". ` +
    `Expected: https://${expectedProjectRef}.supabase.co`
  )
}

// Extract project ref and validate
const projectRefMatch = url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/);
const actualProjectRef = projectRefMatch?.[1];

if (actualProjectRef !== expectedProjectRef) {
  throw new Error(
    `[supabase] Wrong project ref: "${actualProjectRef}". ` +
    `Expected: "${expectedProjectRef}". Update VITE_SUPABASE_URL to https://${expectedProjectRef}.supabase.co`
  )
}

// Cross-check functions URL if provided
if (functionsUrl) {
  const fnRefMatch = functionsUrl.match(/^https:\/\/([a-z0-9]{20})\.functions\.supabase\.co/);
  const fnProjectRef = fnRefMatch?.[1];
  if (fnProjectRef && fnProjectRef !== expectedProjectRef) {
    console.warn(
      `[supabase] Project ref mismatch: Functions URL uses "${fnProjectRef}" but Supabase URL uses "${actualProjectRef}". ` +
      `Both should use "${expectedProjectRef}".`
    );
  }
}

if (typeof window !== 'undefined' && !(window as any).__supabase_validated) {
  console.debug(`[supabase] ✅ Validated project ref: ${actualProjectRef}`);
  (window as any).__supabase_validated = true;
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
auth: {
persistSession: true,
autoRefreshToken: true,
detectSessionInUrl: true,
},
db: { schema: 'public' },
})

// ---- Shared App Types (used only for TypeScript hints) ----------------------

export type UUID = string

export interface FamilyMember {
id: UUID
user_id: UUID
name: string
relationship?: string | null
avatar_url?: string | null
created_at?: string
updated_at?: string
}

export interface Event {
id: UUID
user_id: UUID
title: string
description?: string | null
event_date: string // YYYY-MM-DD
start_time?: string | null // HH:MM:SS
end_time?: string | null // HH:MM:SS
location?: string | null
participants?: string[] | null
event_type?: string | null
rsvp_required?: boolean | null
rsvp_status?: 'pending' | 'yes' | 'no' | 'maybe' | null
source?: 'whatsapp' | 'manual' | 'ai' | null
created_at?: string
updated_at?: string
}

export interface Reminder {
id: UUID
user_id: UUID
title: string
notes?: string | null
reminder_date?: string | null // YYYY-MM-DD
reminder_time?: string | null // HH:MM:SS
priority?: 'low' | 'medium' | 'high' | null
completed?: boolean | null
created_at?: string
updated_at?: string
family_member_id?: UUID | null
}

export interface ShoppingItem {
id: UUID
user_id: UUID
item: string
quantity?: number | null
category?:
| 'dairy' | 'produce' | 'meat' | 'bakery' | 'baby' | 'beverages'
| 'frozen' | 'household' | 'snacks' | 'health' | 'pantry' | 'other'
| string | null
notes?: string | null
completed?: boolean | null
assigned_to?: UUID | null
created_at?: string
updated_at?: string
}