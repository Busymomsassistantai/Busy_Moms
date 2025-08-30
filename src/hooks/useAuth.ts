import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔍 Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error.message)
          // Don't throw here, just log and continue
        }
        
        if (mounted) {
          console.log('📝 Session found:', session ? 'Yes' : 'No')
          setUser(session?.user ?? null)
          // Handle profile creation for authenticated users
          if (session?.user) {
            console.log('👤 User authenticated, handling profile...')
            await handleUserProfile(session.user)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Session fetch failed:', error)
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session ? 'User present' : 'No user')
        if (mounted) {
          setUser(session?.user ?? null)
          // Handle profile creation for new users
          if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            await handleUserProfile(session.user)
          }
          // Set loading to false on any auth state change
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleUserProfile = async (user: User) => {
    try {
      console.log('🔍 Checking profile for user:', user.id)
      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking profile:', checkError)
        return
      }

      if (!existingProfile) {
        console.log('📝 Creating new profile for user:', user.id)
        // Profile doesn't exist, create it
        const profileData = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          user_type: 'Mom' as const,
          onboarding_completed: false,
          ai_personality: 'Friendly' as const
        }

        const { error: createError } = await supabase
          .from('profiles')
          .insert([profileData])
        
        if (createError) {
          console.error('Error creating profile:', createError)
        } else {
          console.log('Profile created successfully for:', profileData.full_name)
        }
      } else {
        console.log('✅ Profile already exists for user:', user.id)
      }
    } catch (error) {
      console.error('Error handling user profile:', error)
    }
  }
  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) console.error('Sign-up error:', error.message)
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })
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
        redirectTo: window.location.origin
      }
    })
    if (error) console.error('Google sign-in error:', error.message)
    return { data, error }
  }

  return { user, loading, signUp, signIn, signOut, signInWithGoogle }
}
