import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { AuthForm } from './components/forms/AuthForm'
import { Onboarding } from './components/Onboarding'
import { Dashboard } from './components/Dashboard'
import { Navigation } from './components/Navigation'
import { Calendar } from './components/Calendar'
import { Contacts } from './components/Contacts'
import { Shopping } from './components/Shopping'
import { Tasks } from './components/Tasks'
import { Settings } from './components/Settings'
import { AIChat } from './components/AIChat'
import { AIVoiceChat } from './components/AIVoiceChat'
import { FamilyFolders } from './components/FamilyFolders'
import { Loader2 } from 'lucide-react'
import { supabase } from './lib/supabase'

export type Screen = 'dashboard' | 'calendar' | 'contacts' | 'shopping' | 'tasks' | 'settings' | 'ai-chat' | 'family-folders'

function App() {
  const { user, loading, signOut } = useAuth()
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)
  const [showVoiceChat, setShowVoiceChat] = useState(false)

  useEffect(() => {
    const checkOnboarding = async () => {
      // Only check onboarding if we have an authenticated user
      if (!user?.id) return

      console.log('🔍 Checking onboarding status for user:', user.id)
      setCheckingOnboarding(true)
      try {
        // Check the actual profile in the database
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle()

        if (!error && profile) {
          console.log('📋 Profile found, onboarding completed:', profile.onboarding_completed)
          setShowOnboarding(!profile.onboarding_completed)
        } else {
          console.log('❌ No profile found or error, showing onboarding')
          // If no profile exists or error, show onboarding
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('Error checking onboarding:', error)
        // If no profile exists or error, show onboarding
        setShowOnboarding(true)
      } finally {
        setCheckingOnboarding(false)
      }
    }

    if (user?.id) {
      checkOnboarding()
    } else {
      // No user, don't show onboarding
      setShowOnboarding(false)
      setCheckingOnboarding(false)
    }
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
    console.log('🔐 No user authenticated, showing sign-in form')
    return (
      <AuthForm 
        onAuthSuccess={() => {
          console.log('✅ Auth success callback triggered')
          // The useEffect will handle checking onboarding status
        }} 
      />
    )
  }

  // Show onboarding if user exists but hasn't completed onboarding
  if (showOnboarding) {
    console.log('📚 Showing onboarding for user:', user.id)
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  console.log('🏠 Showing main app for user:', user.id)
  // Show main app if user is authenticated and has completed onboarding
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        onSignOut={signOut}
        onVoiceChatOpen={() => setShowVoiceChat(true)}
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
            case 'tasks':
              return <Tasks />
            case 'settings':
              return <Settings />
            case 'ai-chat':
              return <AIChat />
            case 'family-folders':
              return <FamilyFolders />
            default:
              return <Dashboard onNavigate={setCurrentScreen} />
          }
        })()}
      </main>
      
      <AIVoiceChat 
        isOpen={showVoiceChat} 
        onClose={() => setShowVoiceChat(false)} 
      />
    </div>
  )
}

export default App