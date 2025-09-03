import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // 1) Handle initial session via getSession (fine) 
    //    (Alternative: rely only on INITIAL_SESSION below.)
    const prime = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) console.error('getSession error:', error.message)
        if (!mounted) return

        setUser(session?.user ?? null)
        setLoading(false)

        if (session?.user) {
          // Don’t block UI on this
          handleUserProfile(session.user).catch((e) =>
            console.error('Profile init error:', e)
          )
        }
      } catch (e) {
        console.error('getSession failed:', e)
        if (mounted) setLoading(false)
      }
    }

    prime()

    // 2) Subscribe to auth changes (correct destructure)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Events include: INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, etc.
        console.log('Auth event:', event)
        if (!mounted) return

        setUser(session?.user ?? null)
        setLoading(false)

        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          // Fire-and-forget; don’t block UI
          handleUserProfile(session.user).catch((e) =>
            console.error('Profile init error:', e)
          )
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleUserProfile = async (user: User) => {
    console.log('Checking profile for user:', user.id)
    
    try {
      // If your RLS requires auth, ensure your policies allow SELECT/INSERT for auth.uid()=id
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      // Ignore "no rows" code (PGRST116)
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Profile check error:', checkError)
        return
      }

      if (!existing) {
        const profileData = {
          id: user.id,
          email: user.email ?? '',
          full_name:
            (user.user_metadata?.full_name ??
             user.user_metadata?.name ??
             user.email?.split('@')[0]) || 'User',
          user_type: 'Mom' as const,
          onboarding_completed: false,
          ai_personality: 'Friendly' as const,
        }

        const { error: createError } = await supabase.from('profiles').insert([profileData])
        if (createError) console.error('Profile create error:', createError)
        else console.log('Profile created:', profileData.full_name)
      } else {
        console.log('Profile exists for user:', user.id)
      }
    } catch (error) {
      console.error('Network error during profile check:', error)
      // Don't throw - let the app continue to work even if profile check fails
    }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) console.error('Sign-up error:', error.message)
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) console.error('Sign-in error:', error.message)
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign-out error:', error.message)
    return { error }
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Prefer a dedicated callback route:
        // redirectTo: `${window.location.origin}/auth/callback`
        redirectTo: window.location.origin
      }
    })
    if (error) console.error('Google sign-in error:', error.message)
    return { data, error }
  }

  return { user, loading, signUp, signIn, signOut, signInWithGoogle }
}
