import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export async function getActiveSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting session:', error);
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getActiveSession();
  return session?.access_token ?? null;
}
