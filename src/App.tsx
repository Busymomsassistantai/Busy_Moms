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

  useEffect(() => {
    // Show onboarding for users who haven't completed it
    const checkOnboardingStatus = async () => {
      if (!user) {
        setShowOnboarding(false);
        return;
      }

      try {
        // Check if user has completed onboarding in their profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking onboarding status:', error);
          // If we can't check, assume they need onboarding
          setShowOnboarding(true);
          return;
        }

        // Show onboarding if profile doesn't exist or onboarding not completed
        const needsOnboarding = !profile || !profile.onboarding_completed;
        setShowOnboarding(needsOnboarding);
      } catch (error) {
        console.error('Error in onboarding check:', error);
        setShowOnboarding(true);
      }
    };

    if (user) {
      checkOnboardingStatus();
    } else {
      setShowOnboarding(false)
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => setShowOnboarding(false)} />
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  const renderScreen = () => {
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
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        onSignOut={signOut}
      />
      <main className="pb-20">
        {renderScreen()}
      </main>
    </div>
  )
}

export default App