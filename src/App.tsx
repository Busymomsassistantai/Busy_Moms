import React, { useState, useEffect } from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { AuthForm } from './components/forms/AuthForm';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { Calendar } from './components/Calendar';
import { Contacts } from './components/Contacts';
import { Shopping } from './components/Shopping';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';
import { AIChat } from './components/AIChat';
import { AIVoiceChat } from './components/AIVoiceChat';
import { useAuth } from './hooks/useAuth';
import { supabase, Profile } from './lib/supabase';

export type Screen = 'dashboard' | 'calendar' | 'contacts' | 'shopping' | 'settings';

export default function App() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Load user profile and check onboarding status
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setLoadingProfile(false);
        return;
      }
      
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (!error && profileData) {
          setProfile(profileData);
          setShowOnboarding(!profileData.onboarding_completed);
        } else if (!profileData) {
          // No profile exists, show onboarding
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setShowOnboarding(true);
      } finally {
        setLoadingProfile(false);
      }
    };
    
    if (user) {
      loadProfile();
    } else {
      setLoadingProfile(false);
    }
  }, [user]);

  // Handle URL parameters (for OAuth callbacks)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleStatus = urlParams.get('google');
    
    if (googleStatus === 'connected') {
      console.log('✅ Google Calendar connected successfully');
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleStatus === 'error') {
      const reason = urlParams.get('reason');
      console.error('❌ Google Calendar connection failed:', reason);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setCurrentScreen('dashboard');
  };

  const handleSignOut = async () => {
    setCurrentScreen('dashboard');
    setProfile(null);
    setShowOnboarding(false);
  };

  // Loading state
  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your assistant...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  // Show onboarding for new users
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Main app with navigation
  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentScreen} />;
      case 'calendar':
        return <Calendar />;
      case 'contacts':
        return <Contacts />;
      case 'shopping':
        return <Shopping />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderScreen()}
      
      <Navigation
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
        onSignOut={handleSignOut}
      />

      {/* Floating AI Chat Button */}
      <button
        onClick={() => setShowAIChat(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-40 flex items-center justify-center"
        title="Open AI Chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Floating Voice Chat Button */}
      <button
        onClick={() => setShowVoiceChat(true)}
        className="fixed bottom-24 right-24 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-40 flex items-center justify-center"
        title="Open Voice Chat"
      >
        <Phone className="w-6 h-6" />
      </button>

      <AIChat isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
      <AIVoiceChat isOpen={showVoiceChat} onClose={() => setShowVoiceChat(false)} />
    </div>
  );
}