import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'
import { getOAuthConfig } from '../lib/auth-config'
import { captureAndStoreGoogleTokens } from '../services/googleTokenStorage'

export function useAuth() {
  const session = useSessionContext()
  const supabase = useSupabaseClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let processingProfile = false
    let initialSessionHandled = false

    // Track which user IDs we've already processed to prevent duplicates
    const processedUserIds = new Set<string>()

    // Handle user profile with deduplication
    const safeHandleUserProfile = async (user: User, event: string) => {
      // Prevent duplicate processing
      if (processingProfile || processedUserIds.has(user.id)) {
        return
      }

      processingProfile = true
      processedUserIds.add(user.id)

      try {
        await handleUserProfile(user)
      } catch (e) {
        console.error('Profile init error:', e)
      } finally {
        processingProfile = false
      }
    }

    // Use session from context to set user
    if (session?.user) {
      setUser(session.user)
      setLoading(false)
    } else {
      setUser(null)
      setLoading(false)
    }

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, authSession) => {
        if (!mounted) return

        setUser(authSession?.user ?? null)
        setLoading(false)

        if (authSession?.user) {
          // Only handle INITIAL_SESSION once
          if (event === 'INITIAL_SESSION') {
            if (initialSessionHandled) return
            initialSessionHandled = true
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            // Fire-and-forget with deduplication
            safeHandleUserProfile(authSession.user, event)

            // Capture Google provider tokens if this is a Google OAuth sign-in
            if (event === 'SIGNED_IN' && authSession.provider_token) {
              captureAndStoreGoogleTokens(authSession).catch((e) =>
                console.error('❌ Failed to capture Google tokens:', e)
              )
            }
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [session, supabase])

  const handleUserProfile = async (user: User) => {
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
    console.log('🔐 Initiating Google OAuth with config:', getOAuthConfig());

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: getOAuthConfig()
    });

    if (error) {
      console.error('❌ Google sign-in error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        full_error: error
      });
    } else {
      console.log('🚀 Google OAuth initiated successfully');
      console.log('OAuth data:', data);
    }
    return { data, error }
  }

  return { user, loading, signUp, signIn, signOut, signInWithGoogle }
}
