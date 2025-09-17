import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
throw new Error(
'[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
'Ensure your environment variables are set. Refusing to fall back to a hardcoded project.'
)
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