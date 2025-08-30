import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { AuthForm } from './components/forms/AuthForm'
import { Onboarding } from './components/Onboarding'
import { Dashboard } from './components/Dashboard'
import { Navigation } from './components/Navigation'
import { Calendar } from './components/Calendar'
import { Contacts } from './components/Contacts'
import { Shopping } from './components/Shopping'
import { Settings } from './components/Settings'
import { AIChat } from './components/AIChat'
import { Loader2 } from 'lucide-react'
import { supabase } from './lib/supabase'

export type Screen = 'dashboard' | 'calendar' | 'contacts' | 'shopping' | 'settings' | 'ai-chat'

function App() {
  const { user, loading, signOut } = useAuth()
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)

  useEffect(() => {
    const checkOnboarding = async () => {
      // Only check onboarding if we have an authenticated user
      if (!user?.id) return

      setCheckingOnboarding(true)
      try {
        // Check the actual profile in the database
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle()

        if (!error && profile) {
          setShowOnboarding(!profile.onboarding_completed)
        } else {
          // If no profile exists or error, show onboarding
          setShowOnboarding(true)
        }
      } catch (error) {
        // If no profile exists or error, show onboarding
        setShowOnboarding(true)
      } finally {
        setCheckingOnboarding(false)
      }
    }

    checkOnboarding()
  }, [user])

  // Show loading only when we're checking auth or onboarding for authenticated users
  if (loading || (user && checkingOnboarding)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">
            {loading ? 'Loading...' : checkingOnboarding ? 'Checking your profile...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  // Show sign-in form if no user is authenticated
  if (!user) {
    return (
      <AuthForm 
        onAuthSuccess={() => {
          // The useEffect will handle checking onboarding status
        }} 
      />
    )
  }

  // Show onboarding if user exists but hasn't completed onboarding
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  // Show main app if user is authenticated and has completed onboarding
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        onSignOut={signOut}
      />
      <main className="pb-20">
        {(() => {
          switch (currentScreen) {
            case 'dashboard':
              return <Dashboard onNavigate={setCurrentScreen} />
            case 'calendar':
              return <Calendar />
            case 'contacts':
              return <Contacts />
            case 'shopping':
              return <Shopping />
            case 'settings':
              return <Settings />
            case 'ai-chat':
              return <AIChat />
            default:
              return <Dashboard onNavigate={setCurrentScreen} />
          }
        })()}
      </main>
    </div>
  )
}

export default App