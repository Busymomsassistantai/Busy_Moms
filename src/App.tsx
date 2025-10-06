import { useState, useEffect } from 'react'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useAuth } from './hooks/useAuth'
import { AuthForm } from './components/forms/AuthForm'
import { Onboarding } from './components/Onboarding'
import { Dashboard } from './components/Dashboard'
import { ImprovedNavigation } from './components/ImprovedNavigation'
import { FamilyHub } from './components/FamilyHub'
import { MoreMenu } from './components/MoreMenu'
import { Calendar } from './components/Calendar'
import { Contacts } from './components/Contacts'
import { Shopping } from './components/Shopping'
import { Tasks } from './components/Tasks'
import { Settings } from './components/Settings'
import { AIChat } from './components/AIChat'
import { AIVoiceChat } from './components/AIVoiceChat'
import { FamilyFolders } from './components/FamilyFolders'
import { OAuthDiagnostics } from './components/OAuthDiagnostics'
import { AffirmationNotification } from './components/AffirmationNotification'
import { DailyAffirmations } from './components/DailyAffirmations'
import { Loader2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import { ErrorBoundary, FeatureErrorBoundary } from './components/errors/ErrorBoundary'
import { ToastContainer } from './components/errors/ErrorToast'
import { useToast } from './hooks/useErrorHandler'
import { useAffirmationNotifier } from './hooks/useAffirmationNotifier'
import { captureAndStoreGoogleTokens } from './services/googleTokenStorage'

export type Screen = 'dashboard' | 'calendar' | 'family' | 'more' | 'ai-chat'
export type SubScreen = 'shopping' | 'tasks' | 'contacts' | 'family-folders' | 'settings'

function App() {
  const session = useSessionContext()
  const supabaseClient = useSupabaseClient()
  const { user, loading, signOut } = useAuth()
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard')
  const [currentSubScreen, setCurrentSubScreen] = useState<SubScreen | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)
  const [showVoiceChat, setShowVoiceChat] = useState(false)
  const [showAffirmations, setShowAffirmations] = useState(false)
  const { toasts, removeToast } = useToast()
  const { pendingAffirmation, dismissNotification } = useAffirmationNotifier()

  // Check if diagnostics mode is enabled
  const urlParams = new URLSearchParams(window.location.search);
  const showDiagnostics = urlParams.get('diagnostics') === 'true';

  // Show diagnostics page if requested
  if (showDiagnostics) {
    return <OAuthDiagnostics />;
  }

  // Handle OAuth callback and errors
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hashParams = hash ? new URLSearchParams(hash.substring(1)) : null;

      // Check for OAuth error in URL or hash
      const error = urlParams.get('error') || hashParams?.get('error');
      const errorCode = urlParams.get('error_code') || hashParams?.get('error_code');
      const errorDescription = urlParams.get('error_description') || hashParams?.get('error_description');

      // Check if this is an OAuth callback (has code or access_token)
      const authCode = urlParams.get('code');
      const accessToken = hashParams?.get('access_token');

      if (error) {
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
      } else if (authCode || accessToken) {
        // This is an OAuth callback - clean up URL immediately to prevent stale session warnings
        const cleanUrl = () => {
          if (window.location.search.includes('code=') || window.location.hash.includes('access_token')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        };

        // Clean up URL after a brief delay to allow Supabase to process
        const cleanupTimer = setTimeout(cleanUrl, 500);

        // Capture Google provider tokens from the OAuth callback (fire-and-forget)
        supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
          if (!error && session?.provider_token && session?.provider_refresh_token) {
            captureAndStoreGoogleTokens(session).catch((e) => {
              console.error('❌ Error capturing Google tokens:', e);
            });
          }
        });

        return () => clearTimeout(cleanupTimer);
      }
    };

    handleOAuthCallback();
  }, []);

  useEffect(() => {
    let mounted = true

    const checkOnboarding = async () => {
      // Only check onboarding if we have an authenticated user
      if (!user?.id) return

      setCheckingOnboarding(true)
      try {
        // Check the actual profile in the database
        const { data: profile, error } = await supabaseClient
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle()

        if (!mounted) return

        if (!error && profile) {
          setShowOnboarding(!profile.onboarding_completed)
        } else {
          // If no profile exists or error, show onboarding
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('Error checking onboarding:', error)
        if (!mounted) return
        // If no profile exists or error, show onboarding
        setShowOnboarding(true)
      } finally {
        if (mounted) setCheckingOnboarding(false)
      }
    }

    if (user?.id) {
      checkOnboarding()
    } else {
      // No user, don't show onboarding
      setShowOnboarding(false)
      setCheckingOnboarding(false)
    }

    return () => {
      mounted = false
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
        <ImprovedNavigation
          currentScreen={currentScreen}
          onScreenChange={(screen) => {
            setCurrentScreen(screen);
            setCurrentSubScreen(null);
          }}
          onSignOut={signOut}
          onVoiceChatOpen={() => setShowVoiceChat(true)}
        />
        <main className="pb-20">
          {currentSubScreen ? (
            <>
              {currentSubScreen === 'shopping' && (
                <FeatureErrorBoundary featureName="Shopping">
                  <Shopping />
                </FeatureErrorBoundary>
              )}
              {currentSubScreen === 'tasks' && (
                <FeatureErrorBoundary featureName="Tasks">
                  <Tasks />
                </FeatureErrorBoundary>
              )}
              {currentSubScreen === 'contacts' && (
                <FeatureErrorBoundary featureName="Contacts">
                  <Contacts />
                </FeatureErrorBoundary>
              )}
              {currentSubScreen === 'family-folders' && (
                <FeatureErrorBoundary featureName="Family Folders">
                  <FamilyFolders />
                </FeatureErrorBoundary>
              )}
              {currentSubScreen === 'settings' && (
                <FeatureErrorBoundary featureName="Settings">
                  <Settings />
                </FeatureErrorBoundary>
              )}
            </>
          ) : (
            <>
              {currentScreen === 'dashboard' && (
                <FeatureErrorBoundary featureName="Dashboard">
                  <Dashboard
                    onNavigate={setCurrentScreen}
                    onNavigateToSubScreen={setCurrentSubScreen}
                  />
                </FeatureErrorBoundary>
              )}
              {currentScreen === 'calendar' && (
                <FeatureErrorBoundary featureName="Calendar">
                  <Calendar />
                </FeatureErrorBoundary>
              )}
              {currentScreen === 'family' && (
                <FeatureErrorBoundary featureName="Family Hub">
                  <FamilyHub onNavigateToSubScreen={setCurrentSubScreen} />
                </FeatureErrorBoundary>
              )}
              {currentScreen === 'more' && (
                <FeatureErrorBoundary featureName="More Menu">
                  <MoreMenu
                    onNavigateToSubScreen={setCurrentSubScreen}
                    onSignOut={signOut}
                    userName={user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]}
                    userEmail={user?.email}
                  />
                </FeatureErrorBoundary>
              )}
              {currentScreen === 'ai-chat' && (
                <FeatureErrorBoundary featureName="AI Chat">
                  <AIChat />
                </FeatureErrorBoundary>
              )}
            </>
          )}
        </main>

        <AIVoiceChat
          isOpen={showVoiceChat}
          onClose={() => setShowVoiceChat(false)}
        />

        <AffirmationNotification
          affirmation={pendingAffirmation}
          onDismiss={dismissNotification}
          onView={() => {
            dismissNotification();
            setShowAffirmations(true);
          }}
        />

        <DailyAffirmations
          isOpen={showAffirmations}
          onClose={() => setShowAffirmations(false)}
        />

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </ErrorBoundary>
  )
}

export default App