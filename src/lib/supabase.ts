import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xmwavumggnlffdtedjdb.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'busy-moms-app'
    }
  }
})

// Database types
export interface Profile {
  id: string
  email: string
  full_name?: string
  user_type?: 'Mom' | 'Dad' | 'Guardian' | 'Other'
  onboarding_completed?: boolean
  ai_personality?: 'Friendly' | 'Professional' | 'Humorous'
  created_at?: string
  updated_at?: string
}

export interface FamilyMember {
  id: string
  user_id: string
  name: string
  age?: number
  gender?: 'Boy' | 'Girl' | 'Other'
  allergies?: string[]
  medical_notes?: string
  school?: string
  grade?: string
  created_at?: string
  updated_at?: string
}

export interface Event {
  id: string
  user_id: string
  title: string
  description?: string
  event_date: string
  start_time?: string
  end_time?: string
  location?: string
  event_type?: 'sports' | 'party' | 'meeting' | 'medical' | 'school' | 'family' | 'other'
  participants?: string[]
  rsvp_required?: boolean
  rsvp_status?: 'pending' | 'yes' | 'no' | 'maybe'
  source?: 'manual' | 'whatsapp' | 'calendar_sync'
  whatsapp_message_id?: string
  created_at?: string
  updated_at?: string
}

export interface Contact {
  id: string
  user_id: string
  name: string
  role: string
  phone?: string
  email?: string
  category?: 'babysitter' | 'coach' | 'doctor' | 'tutor' | 'teacher' | 'other'
  rating?: number
  notes?: string
  verified?: boolean
  background_check_date?: string
  background_check_status?: 'pending' | 'passed' | 'failed' | 'expired'
  available?: boolean
  last_contact?: string
  created_at?: string
  updated_at?: string
}

export interface ShoppingItem {
  id: string
  user_id: string
  item: string
  category?: 'dairy' | 'produce' | 'meat' | 'bakery' | 'baby' | 'household' | 'other'
  completed?: boolean
  urgent?: boolean
  quantity?: number
  notes?: string
  assigned_to?: string
  created_at?: string
}

export interface Reminder {
  id: string
  user_id: string
  title: string
  description?: string
  reminder_date: string
  reminder_time?: string
  priority?: 'low' | 'medium' | 'high'
  completed?: boolean
  recurring?: boolean
  recurring_pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  family_member_id?: string
  created_at?: string
  updated_at?: string
}