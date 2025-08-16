import React, { useState } from 'react'
import { Heart, Mail, Lock, User } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface AuthFormProps {
  onAuthSuccess: () => void
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const { signUp, signIn } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await signUp(formData.email, formData.password)
        if (error) throw error
        
        // Create profile after successful signup
        if (data.user) {
          // Wait a moment for the auth state to be fully established
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: data.user.id,
              email: data.user.email || formData.email,
              full_name: formData.fullName || '',
              user_type: 'Mom',
              onboarding_completed: false,
              ai_personality: 'Friendly'
            }])
          
          if (profileError) {
            console.error('Profile creation failed:', profileError.message)
            // Don't throw error for profile creation failure, let user proceed
            console.warn('Profile will be created during onboarding instead')
          }
          else {
            console.log('Profile created successfully for user:', data.user.email)
          }
        }
        
        // Don't switch to sign in, let them proceed to onboarding
        onAuthSuccess()
      } else {
        const { error } = await signIn(formData.email, formData.password)
        if (error) throw error
        
        // Check if profile exists for existing user, create if missing
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          const { data: existingProfile, error: profileCheckError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single()
          
          if (profileCheckError && profileCheckError.code === 'PGRST116') {
            // Profile doesn't exist, create it
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([{
                id: currentUser.id,
                email: currentUser.email || formData.email,
                full_name: currentUser.user_metadata?.full_name || 'User',
                user_type: 'Mom',
                onboarding_completed: false,
                ai_personality: 'Friendly'
              }])
            
            if (profileError) {
              console.error('Profile creation failed:', profileError.message)
            } else {
              console.log('Profile created for existing user:', currentUser.email)
            }
          }
        }
        
        onAuthSuccess()
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isSignUp ? 'Join Busy Moms' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600">
            {isSignUp ? 'Create your account to get started' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Your full name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Your password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-purple-600 hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>

        {/* Demo Account */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800 mb-2">Demo Account:</p>
          <div className="text-xs text-blue-600 mb-3">
            <p>Email: demo@busymoms.app</p>
            <p>Password: demo123456</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormData({ ...formData, email: 'demo@busymoms.app', password: 'demo123456' });
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
          >
            Use Demo Credentials
          </button>
        </div>

        {/* Demo Bypass Button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={onAuthSuccess}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            🚀 Skip Sign-In (Demo Mode)
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Bypass authentication for demonstration purposes
          </p>
        </div>
      </div>
    </div>
  )
}