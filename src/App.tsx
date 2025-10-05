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
import { OAuthDiagnostics } from './components/OAuthDiagnostics'
import { Loader2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import { ErrorBoundary, FeatureErrorBoundary } from './components/errors/ErrorBoundary'
import { ToastContainer } from './components/errors/ErrorToast'
import { useToast } from './hooks/useErrorHandler'

export type Screen = 'dashboard' | 'calendar' | 'contacts' | 'shopping' | 'tasks' | 'settings' | 'ai-chat' | 'family-folders'

function App() {
  const { user, loading, signOut } = useAuth()
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)
  const [showVoiceChat, setShowVoiceChat] = useState(false)
  const { toasts, removeToast } = useToast()

  // Check if diagnostics mode is enabled
  const urlParams = new URLSearchParams(window.location.search);
  const showDiagnostics = urlParams.get('diagnostics') === 'true';

  // Show diagnostics page if requested
  if (showDiagnostics) {
    return <OAuthDiagnostics />;
  }

  // Handle OAuth callback and errors
  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hashParams = hash ? new URLSearchParams(hash.substring(1)) : null;

      // Check for OAuth success/error in URL or hash
      const accessToken = urlParams.get('access_token') || hashParams?.get('access_token');
      const error = urlParams.get('error') || hashParams?.get('error');
      const errorCode = urlParams.get('error_code') || hashParams?.get('error_code');
      const errorDescription = urlParams.get('error_description') || hashParams?.get('error_description');

      if (accessToken) {
        console.log('✅ OAuth success - access token found');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (error) {
        // Log comprehensive error details
        const errorDetails = {
          error,
          error_code: errorCode,
          error_description: errorDescription,
          full_url: window.location.href,
          search_params: Object.fromEntries(urlParams.entries()),
          hash_params: hashParams ? Object.fromEntries(hashParams.entries()) : null
        };

        console.error('❌ OAuth error:', errorDetails);
        console.error('Full error object:', JSON.stringify(errorDetails, null, 2));

        // Provide user-friendly error messages
        let userMessage = 'Google sign-in failed';

        if (error === 'server_error' && errorDescription?.includes('Unable to exchange external code')) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR-PROJECT-REF.supabase.co';
          userMessage = `Google sign-in configuration error. Please check:\n\n` +
            `1. In Supabase Dashboard (Authentication > Providers > Google):\n` +
            `   - Google OAuth is enabled\n` +
            `   - Client ID and Secret have NO extra spaces\n\n` +
            `2. In Google Cloud Console (APIs & Credentials):\n` +
            `   - Authorized redirect URI:\n` +
            `     ${supabaseUrl}/auth/v1/callback\n` +
            `   - Authorized JavaScript origin:\n` +
            `     ${window.location.origin}\n\n` +
            `3. Google Calendar API is enabled in your Google Cloud project\n\n` +
            `Error: ${errorDescription || error}`;
        } else if (errorDescription) {
          userMessage = `Google sign-in failed:\n\n${errorDescription}\n\nPlease check your OAuth configuration.`;
        } else {
          userMessage = `Google sign-in failed: ${error}\n\nCheck the console for more details.`;
        }

        alert(userMessage);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Clean up any OAuth-related URL parameters
      if (window.location.search.includes('code=') || window.location.hash.includes('access_token')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleOAuthCallback();
  }, []);

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
    <ErrorBoundary componentName="App">
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
                return (
                  <FeatureErrorBoundary featureName="Dashboard">
                    <Dashboard onNavigate={setCurrentScreen} />
                  </FeatureErrorBoundary>
                )
              case 'calendar':
                return (
                  <FeatureErrorBoundary featureName="Calendar">
                    <Calendar />
                  </FeatureErrorBoundary>
                )
              case 'contacts':
                return (
                  <FeatureErrorBoundary featureName="Contacts">
                    <Contacts />
                  </FeatureErrorBoundary>
                )
              case 'shopping':
                return (
                  <FeatureErrorBoundary featureName="Shopping">
                    <Shopping />
                  </FeatureErrorBoundary>
                )
              case 'tasks':
                return (
                  <FeatureErrorBoundary featureName="Tasks">
                    <Tasks />
                  </FeatureErrorBoundary>
                )
              case 'settings':
                return (
                  <FeatureErrorBoundary featureName="Settings">
                    <Settings />
                  </FeatureErrorBoundary>
                )
              case 'ai-chat':
                return (
                  <FeatureErrorBoundary featureName="AI Chat">
                    <AIChat />
                  </FeatureErrorBoundary>
                )
              case 'family-folders':
                return (
                  <FeatureErrorBoundary featureName="Family Folders">
                    <FamilyFolders />
                  </FeatureErrorBoundary>
                )
              default:
                return (
                  <FeatureErrorBoundary featureName="Dashboard">
                    <Dashboard onNavigate={setCurrentScreen} />
                  </FeatureErrorBoundary>
                )
            }
          })()}
        </main>

        <AIVoiceChat
          isOpen={showVoiceChat}
          onClose={() => setShowVoiceChat(false)}
        />

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </ErrorBoundary>
  )
}

export default App