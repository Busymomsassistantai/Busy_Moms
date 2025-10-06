import React, { useState } from 'react'
import { Heart, Mail, Lock, User, Chrome } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface AuthFormProps {
  onAuthSuccess: () => void
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const { signUp, signIn, signInWithGoogle } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
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
        if (error) {
          if (error.message.includes('User already registered')) {
            alert('This email is already registered. Please sign in instead, or use a different email to sign up.')
            setIsSignUp(false) // Switch to sign-in mode
            return
          }
          throw error
        }
        
        // Create profile after successful signup
        if (data.user) {
          console.log('User created successfully, profile will be created during onboarding')
        }
        
        // Don't switch to sign in, let them proceed to onboarding
        // For new signups, they'll go through onboarding
        // onAuthSuccess() will be called after onboarding is complete
      } else {
        const { error } = await signIn(formData.email, formData.password)
        if (error) throw error
        
        // For existing users signing in, go directly to dashboard
        onAuthSuccess()
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    console.log('🔐 Google sign-in button clicked');
    setGoogleLoading(true)
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        console.error('Google sign-in error:', error)
        alert(`Google sign-in failed: ${error.message}\n\nPlease check:\n1. Google OAuth is configured in Supabase\n2. This domain is added to authorized origins\n3. Redirect URI is set correctly`)
        setGoogleLoading(false)
        return
      }
      console.log('🚀 Google OAuth redirect initiated...');
      // OAuth redirect will handle the rest, loading state will be reset on page reload
    } catch (error: any) {
      console.error('Google sign-in error:', error)
      alert(`Google sign-in failed: ${error.message}\n\nThis might be a configuration issue. Please check your Supabase Google OAuth settings.`)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-theme-surface rounded-xl sm:rounded-2xl shadow-xl w-full max-w-sm sm:max-w-md p-4 sm:p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme-fg mb-2">
            {isSignUp ? 'Join Busy Moms' : 'Welcome Back'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {isSignUp ? 'Create your account to get started' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                placeholder="Your full name"
              />
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
              <Mail className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
              <Lock className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
              placeholder="Your password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 text-sm sm:text-base"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Google Sign-In */}
        <div className="mt-4 sm:mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs sm:text-sm">
              <span className="px-2 bg-theme-surface text-gray-500">Or continue with</span>
            </div>
          </div>
          
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full mt-3 sm:mt-4 flex items-center justify-center space-x-2 sm:space-x-3 px-3 py-2 sm:px-4 sm:py-3 border border-theme-border rounded-lg hover:bg-theme-secondary transition-colors disabled:opacity-50"
          >
            <Chrome className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            <span className="text-theme-fg opacity-90 font-medium text-sm sm:text-base">
              {googleLoading ? 'Connecting...' : isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
            </span>
          </button>
        </div>

        <div className="mt-4 sm:mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-purple-600 hover:underline text-sm sm:text-base"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>

        {/* Demo Account */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-800 mb-2">Demo Account:</p>
          <div className="text-xs text-theme-primary mb-2 sm:mb-3">
            <p>Email: demo@busymoms.app</p>
            <p>Password: demo123456</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormData({ ...formData, email: 'demo@busymoms.app', password: 'demo123456' });
            }}
            className="px-2 py-1 sm:px-3 bg-theme-primary text-white rounded text-xs hover:bg-theme-primary transition-colors"
          >
            Use Demo Credentials
          </button>
        </div>

        {/* Demo Bypass Button */}
        <div className="mt-3 sm:mt-4">
          <button
            type="button"
            onClick={onAuthSuccess}
            className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:shadow-lg transition-all text-sm sm:text-base"
          >
            🚀 Skip Sign-In (Demo Mode)
          </button>
          <p className="text-xs text-theme-fg opacity-60 text-center mt-2">
            Bypass authentication for demonstration purposes
          </p>
        </div>

        {/* OAuth Diagnostics Link */}
        <div className="mt-3 text-center">
          <a
            href="?diagnostics=true"
            className="text-xs text-theme-fg opacity-60 hover:text-theme-fg opacity-90 underline"
          >
            OAuth Configuration Diagnostics
          </a>
        </div>
      </div>
    </div>
  )
}