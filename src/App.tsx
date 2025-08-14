import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/forms/AuthForm';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { Calendar } from './components/Calendar';
import { Shopping } from './components/Shopping';
import { Contacts } from './components/Contacts';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';

export type Screen = 'onboarding' | 'dashboard' | 'calendar' | 'shopping' | 'contacts' | 'settings';

function App() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding');
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication form if user is not logged in
  if (!user) {
    return <AuthForm onAuthSuccess={() => setCurrentScreen('onboarding')} />;
  }

  const handleOnboardingComplete = () => {
    setIsOnboarded(true);
    setCurrentScreen('dashboard');
  };

  const renderScreen = () => {
    if (!isOnboarded) {
      return <Onboarding onComplete={handleOnboardingComplete} />;
    }

    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'calendar':
        return <Calendar />;
      case 'shopping':
        return <Shopping />;
      case 'contacts':
        return <Contacts />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl relative">
        {renderScreen()}
        {isOnboarded && (
          <Navigation 
            currentScreen={currentScreen} 
            onScreenChange={setCurrentScreen} 
          />
        )}
      </div>
    </div>
  );
}

export default App;